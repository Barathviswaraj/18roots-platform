require "rails_helper"

RSpec.describe "Sign-in and tokens", type: :request do
  let(:phone) { "+919876511111" }
  let(:json) { { "CONTENT_TYPE" => "application/json" } }

  def request_code(number = phone)
    post "/v1/auth/otp", params: { phone: number }.to_json, headers: json
    response.parsed_body
  end

  def verify(request_id, code, number = phone)
    post "/v1/auth/verify", params: { requestId: request_id, phone: number, code: }.to_json, headers: json
    response.parsed_body
  end

  it "signs in with a code, creating the account, and stores only a hash of the code" do
    otp = request_code
    save_contract("otp", otp)
    expect(otp).to include("resendAfterSeconds" => 30, "demoCode" => "123456")
    expect(OtpChallenge.last.code_digest).not_to include("123456")

    session = verify(otp["requestId"], "123456")
    save_contract("session", session)
    expect(response).to have_http_status(:ok)
    expect(session.dig("user", "phone")).to eq(phone)
    expect(User.where(phone:).count).to eq(1)
    expect(AuditEvent.where(action: "auth.signed_in").count).to eq(1)

    # The code works once.
    verify(otp["requestId"], "123456")
    expect(response.parsed_body.dig("error", "code")).to eq("code_expired")
  end

  it "signs a returning patient into the same account" do
    first = verify(request_code["requestId"], "123456")
    OtpChallenge.update_all(created_at: 1.minute.ago)
    second = verify(request_code["requestId"], "123456")

    expect(response).to have_http_status(:ok)
    expect(second.dig("user", "id")).to eq(first.dig("user", "id"))
    expect(User.where(phone:).count).to eq(1)
  end

  it "counts wrong codes and locks the code after five attempts" do
    otp = request_code
    5.times { verify(otp["requestId"], "000000") }
    expect(OtpChallenge.find(otp["requestId"]).attempts).to eq(5)

    verify(otp["requestId"], "123456")
    expect(response.parsed_body.dig("error", "code")).to eq("too_many_attempts")
  end

  it "refuses a second code within 30 seconds and invalid numbers" do
    request_code
    request_code
    expect(response).to have_http_status(:too_many_requests)
    request_code("+911234")
    expect(response.parsed_body.dig("error", "code")).to eq("invalid_phone")
  end

  it "issues RS256 tokens the meeting service can check with the published key" do
    session = verify(request_code["requestId"], "123456")
    get "/.well-known/jwks.json"
    jwk = response.parsed_body.fetch("keys").first
    public_key = JWT::JWK.import(jwk).public_key

    claims, header = JWT.decode(session["accessToken"], public_key, true, algorithm: "RS256")
    expect(header["kid"]).to eq(jwk["kid"])
    expect(claims).to include("iss" => "18roots-main-app", "role" => "patient", "sub" => session.dig("user", "id"))
    expect(claims["aud"]).to include("18roots-meeting-service", "18roots-main-backend")
    expect(claims["exp"] - Time.current.to_i).to be <= 15 * 60
  end

  it "rotates refresh tokens and revokes the family when an old one is replayed" do
    session = verify(request_code["requestId"], "123456")
    post "/v1/auth/refresh", params: { refreshToken: session["refreshToken"] }.to_json, headers: json
    expect(response).to have_http_status(:ok)
    save_contract("tokens", response.parsed_body)
    rotated = response.parsed_body["refreshToken"]

    # Replaying the first token looks like theft: both tokens stop working.
    post "/v1/auth/refresh", params: { refreshToken: session["refreshToken"] }.to_json, headers: json
    expect(response).to have_http_status(:unauthorized)
    post "/v1/auth/refresh", params: { refreshToken: rotated }.to_json, headers: json
    expect(response).to have_http_status(:unauthorized)
    expect(AuditEvent.where(action: "auth.refresh_reused").count).to eq(1)
  end

  it "signs out by revoking the session's refresh tokens" do
    session = verify(request_code["requestId"], "123456")
    post "/v1/auth/logout", headers: json.merge("Authorization" => "Bearer #{session['accessToken']}")
    expect(response).to have_http_status(:no_content)
    post "/v1/auth/refresh", params: { refreshToken: session["refreshToken"] }.to_json, headers: json
    expect(response).to have_http_status(:unauthorized)
  end

  it "rejects missing, forged and service tokens on patient routes" do
    get "/v1/me"
    expect(response).to have_http_status(:unauthorized)

    forged = JWT.encode({ sub: create_patient.id, role: "patient", iss: "18roots-main-app", aud: "18roots-main-backend",
                          exp: 5.minutes.from_now.to_i }, OpenSSL::PKey::RSA.generate(2048), "RS256")
    get "/v1/me", headers: { "Authorization" => "Bearer #{forged}" }
    expect(response).to have_http_status(:unauthorized)

    get "/v1/me", headers: { "Authorization" => "Bearer #{AccessTokens.service_token}" }
    expect(response).to have_http_status(:unauthorized)
  end
end
