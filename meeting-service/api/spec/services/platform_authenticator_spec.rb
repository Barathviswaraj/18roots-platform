require "rails_helper"

RSpec.describe PlatformAuthenticator do
  def authenticate(token)
    described_class.new.authenticate(authorization: "Bearer #{token}")
  end

  around { |example| with_platform_tokens { example.run } }

  it "accepts a token signed with the current shared secret" do
    actor = authenticate(platform_token(role: "doctor", sub: "doctor-1"))

    expect(actor.role).to eq("doctor")
    expect(actor.subject).to eq("doctor-1")
  end

  it "accepts the previous secret only while it is configured" do
    old_secret = "old-platform-secret-0123456789abcdef0123456789"
    token = platform_token(role: "patient", sub: "patient-1", key: old_secret)

    expect { authenticate(token) }.to raise_error(described_class::InvalidCredentials)
    with_env("PLATFORM_JWT_PREVIOUS_SECRET" => old_secret) do
      expect(authenticate(token).subject).to eq("patient-1")
    end
  end

  it "rejects wrong audience, wrong issuer, expired tokens and unknown roles" do
    [
      platform_token(role: "doctor", sub: "doctor-1", aud: "another-service"),
      platform_token(role: "doctor", sub: "doctor-1", iss: "someone-else"),
      platform_token(role: "doctor", sub: "doctor-1", exp: 2.minutes.ago.to_i),
      platform_token(role: "admin", sub: "admin-1"),
      platform_token(role: "doctor", sub: "")
    ].each do |token|
      expect { authenticate(token) }.to raise_error(described_class::InvalidCredentials)
    end
  end

  context "with the main backend's public key" do
    let(:rsa_key) { OpenSSL::PKey::RSA.generate(2048) }
    let(:public_pem) { rsa_key.public_to_pem }

    it "accepts RS256 tokens, including a PEM stored on one line" do
      token = platform_token(role: "service", sub: "main-backend", key: rsa_key, algorithm: "RS256")

      with_env("PLATFORM_JWT_SECRET" => nil, "PLATFORM_JWT_PUBLIC_KEY" => public_pem.gsub("\n", "\\n")) do
        expect(authenticate(token).role).to eq("service")
      end
    end

    it "accepts ES256 tokens from an EC key" do
      ec_key = OpenSSL::PKey::EC.generate("prime256v1")
      token = platform_token(role: "doctor", sub: "doctor-9", key: ec_key, algorithm: "ES256")

      with_env("PLATFORM_JWT_SECRET" => nil, "PLATFORM_JWT_PUBLIC_KEY" => ec_key.public_to_pem) do
        expect(authenticate(token).subject).to eq("doctor-9")
      end
    end

    it "rejects an HS256 token that uses the public key as its secret" do
      forged = platform_token(role: "service", sub: "main-backend", key: public_pem, algorithm: "HS256")

      with_env("PLATFORM_JWT_SECRET" => nil, "PLATFORM_JWT_PUBLIC_KEY" => public_pem) do
        expect { authenticate(forged) }.to raise_error(described_class::InvalidCredentials)
      end
    end

    it "rejects RS256 tokens signed by a different key" do
      other_key = OpenSSL::PKey::RSA.generate(2048)
      token = platform_token(role: "service", sub: "main-backend", key: other_key, algorithm: "RS256")

      with_env("PLATFORM_JWT_SECRET" => nil, "PLATFORM_JWT_PUBLIC_KEY" => public_pem) do
        expect { authenticate(token) }.to raise_error(described_class::InvalidCredentials)
      end
    end
  end
end
