require "rails_helper"

RSpec.describe "Rate limit keys" do
  def key_for(throttle_name, path:, method: "POST", ip: "203.0.113.7", headers: {})
    env = Rack::MockRequest.env_for(path, { method:, "REMOTE_ADDR" => ip }.merge(headers))
    Rack::Attack.throttles.fetch(throttle_name).block.call(Rack::Attack::Request.new(env))
  end

  let(:doctor) { { "HTTP_X_DEMO_ROLE" => "doctor", "HTTP_X_DEMO_USER_REFERENCE" => "doctor-1" } }

  it "counts signed-in users per person, not per shared IP address" do
    expect(key_for("api/user", path: "/api/v1/meetings", headers: doctor)).to eq("doctor:doctor-1")
    expect(key_for("api/anonymous-ip", path: "/api/v1/meetings", headers: doctor)).to be_nil
  end

  it "counts requests without valid credentials per IP address" do
    expect(key_for("api/anonymous-ip", path: "/api/v1/meetings")).to eq("203.0.113.7")
    expect(key_for("api/user", path: "/api/v1/meetings")).to be_nil
  end

  it "gives the main backend its own limit" do
    with_platform_tokens do
      service = { "HTTP_AUTHORIZATION" => "Bearer #{platform_token(role: 'service', sub: 'main-backend')}" }

      expect(key_for("api/service", path: "/api/v1/meetings", headers: service)).to eq("main-backend")
      expect(key_for("api/user", path: "/api/v1/meetings", headers: service)).to be_nil
    end
  end

  it "keeps LiveKit webhooks out of the API limits" do
    path = "/api/v1/livekit/webhook"

    expect(key_for("livekit-webhook/ip", path:)).to eq("203.0.113.7")
    expect(key_for("api/anonymous-ip", path:)).to be_nil
    expect(key_for("api/user", path:)).to be_nil
  end

  it "ignores health checks" do
    expect(key_for("api/anonymous-ip", path: "/health/ready", method: "GET")).to be_nil
  end
end
