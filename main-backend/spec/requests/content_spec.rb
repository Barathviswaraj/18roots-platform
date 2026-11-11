require "rails_helper"

RSpec.describe "App content", type: :request do
  before { Rails.application.load_seed }

  let(:patient) { User.find_by!(phone: "+919876543210") }
  let(:headers) { auth_headers(patient) }

  it "builds the home screen from sections" do
    get "/v1/home", headers: headers
    save_contract("home", response.parsed_body)
    expect(response.parsed_body["sections"].map { _1["type"] })
      .to eq(%w[care_journey upcoming_consultation medicine_reminder order_tracking])
    expect(response.parsed_body).to include("unreadNotifications" => 1, "user" => { "name" => "Anika", "avatarUrl" => nil })

    get "/v1/home", headers: headers.merge("Accept-Language" => "ta-IN")
    expect(response.parsed_body["message"]).to eq(HomeView::MESSAGES["ta"])
  end

  it "marks today's doses and goals and records that the plan was viewed" do
    get "/v1/care-plan", headers: headers
    save_contract("care_plan", response.parsed_body)
    plan = response.parsed_body["plan"]
    expect(plan).to include("programName" => "PCOD Care Journey", "week" => 6, "totalWeeks" => 12)
    expect(plan["weekAdherence"].size).to eq(7)
    expect(AuditEvent.where(action: "care_plan.viewed").count).to eq(1)

    dose = plan["doses"].first
    post "/v1/care-plan/doses/#{dose['id']}", params: { taken: true }.to_json, headers: headers
    save_contract("dose", response.parsed_body)
    expect(response.parsed_body["takenAt"]).to be_present
    get "/v1/home", headers: headers
    reminder = response.parsed_body["sections"].find { _1["type"] == "medicine_reminder" }
    expect(reminder.dig("data", "dose", "id")).not_to eq(dose["id"])

    goal = plan["goals"].find { !_1["done"] }
    put "/v1/care-plan/goals/#{goal['id']}", params: { done: true }.to_json, headers: headers
    save_contract("goal", response.parsed_body)
    expect(response.parsed_body["done"]).to be(true)
  end

  it "searches doctors and shows full details before booking" do
    get "/v1/doctors", params: { query: "pcod" }, headers: headers
    save_contract("doctors", response.parsed_body)
    expect(response.parsed_body["doctors"].map { _1["name"] }).to contain_exactly("Dr. Kavitha Raman", "Dr. Meera Krishnan")

    get "/v1/doctors", params: { language: "Hindi" }, headers: headers
    expect(response.parsed_body["doctors"].map { _1["name"] }).to eq(["Dr. Priya Sundar"])

    doctor = Doctor.find_by!(name: "Dr. Meera Krishnan")
    get "/v1/doctors/#{doctor.id}", headers: headers
    save_contract("doctor", response.parsed_body)
    expect(response.parsed_body).to include("verified" => true, "registrationNumber" => "TNSIDDHA-04821",
                                            "fee" => { "amount" => 600, "currency" => "INR" })
    expect(response.parsed_body["nextAvailableAt"]).to be_present
  end

  it "lists consultations, orders and notifications" do
    get "/v1/consultations", params: { scope: "past" }, headers: headers
    save_contract("consultations", response.parsed_body)
    past = response.parsed_body["consultations"].first
    expect(past).to include("status" => "completed")
    expect(past["followUp"].first["title"]).to eq("Daily routine")

    get "/v1/orders", params: { status: "active" }, headers: headers
    save_contract("orders", response.parsed_body)
    order = response.parsed_body["orders"].first
    expect(order).to include("number" => "180524", "status" => "out_for_delivery", "total" => 920)
    expect(order["timeline"].map { _1["status"] }).to eq(%w[placed packed shipped out_for_delivery delivered])

    get "/v1/notifications", headers: headers
    save_contract("notifications", response.parsed_body)
    unread = response.parsed_body["notifications"].find { !_1["read"] }
    post "/v1/notifications/#{unread['id']}/read", headers: headers
    post "/v1/notifications/read-all", headers: headers
    expect(patient.notifications.unread.count).to eq(0)
  end

  it "updates the profile and validates it" do
    patch "/v1/me", params: { name: "Anika R", email: "", dateOfBirth: "14/02/1996", city: "Madurai" }.to_json, headers: headers
    save_contract("me", response.parsed_body)
    expect(response.parsed_body).to include("name" => "Anika R", "email" => nil, "city" => "Madurai", "dateOfBirth" => "14/02/1996")

    patch "/v1/me", params: { dateOfBirth: "31/02/1996" }.to_json, headers: headers
    expect(response).to have_http_status(:bad_request)
    patch "/v1/me", params: { email: "not-an-email" }.to_json, headers: headers
    expect(response).to have_http_status(:unprocessable_content)
  end
end
