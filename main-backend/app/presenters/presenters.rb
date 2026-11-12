# JSON shapes for the mobile app. They must match 18roots_app/src/api/schemas.ts;
# spec/contract writes real responses that the app's tests check against it.
module Presenters
  module_function

  def time(value) = value&.utc&.iso8601(3)

  def user(user)
    {
      id: user.id,
      name: user.name.to_s,
      phone: user.phone,
      email: user.email.presence,
      dateOfBirth: user.date_of_birth&.strftime("%d/%m/%Y"),
      city: user.city.presence,
      avatarUrl: user.avatar_url,
      programName: user.active_care_plan&.program_name,
      role: user.role
    }
  end

  def session(tokens, user)
    {
      accessToken: tokens.fetch(:access_token),
      refreshToken: tokens.fetch(:refresh_token),
      expiresAt: time(tokens.fetch(:expires_at)),
      user: user(user)
    }
  end

  def tokens(tokens)
    { accessToken: tokens.fetch(:access_token), refreshToken: tokens.fetch(:refresh_token), expiresAt: time(tokens.fetch(:expires_at)) }
  end

  def doctor_summary(doctor)
    { id: doctor.id, name: doctor.name, title: doctor.title, photoUrl: doctor.photo_url }
  end

  def doctor(doctor, next_available_at: nil)
    doctor_summary(doctor).merge(
      verified: doctor.verified?,
      registrationNumber: doctor.registration_number,
      qualifications: doctor.qualifications,
      experienceYears: doctor.experience_years,
      languages: doctor.languages,
      specialties: doctor.specialties,
      fee: { amount: doctor.fee_amount, currency: "INR" },
      consultationMinutes: doctor.consultation_minutes,
      rating: doctor.rating&.to_f,
      about: doctor.about,
      cancellationPolicy: doctor.cancellation_policy,
      nextAvailableAt: time(next_available_at)
    )
  end

  def slot(slot)
    { id: slot.id, startsAt: time(slot.starts_at), endsAt: time(slot.ends_at), available: slot.available }
  end

  def note(note)
    { id: note.id, title: note.title, body: note.body, sharedAt: time(note.shared_at) }
  end

  def consultation(appointment, now: Time.current)
    {
      id: appointment.id,
      status: appointment.app_status(now),
      startsAt: time(appointment.starts_at),
      endsAt: time(appointment.ends_at),
      joinOpensAt: time(appointment.join_opens_at),
      mode: "video",
      doctor: doctor_summary(appointment.doctor),
      reason: appointment.reason,
      meetingId: appointment.meeting_id,
      canCancel: appointment.patient_can_cancel?(now),
      cancellationPolicy: appointment.doctor.cancellation_policy,
      followUp: appointment.care_notes.sort_by(&:shared_at).map { |item| note(item) }
    }
  end

  PAYMENT_STATUS = { "created" => "requires_payment", "paid" => "paid", "failed" => "failed",
                     "refund_pending" => "paid", "refunded" => "paid" }.freeze

  def booking(appointment, now: Time.current)
    payment = appointment.payment
    status = if payment.status == "failed" || appointment.status == "expired" then "failed"
             elsif appointment.status == "held" then "pending_payment"
             else "confirmed"
             end
    {
      id: appointment.id,
      status:,
      consultation: consultation(appointment, now:),
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: PAYMENT_STATUS.fetch(payment.status),
        provider: payment.provider,
        checkoutUrl: payment.checkout_url
      }
    }
  end

  def order(order)
    times = order.events.to_h { |event| [event.status, event.at] }
    steps = order.status == "cancelled" ? %w[placed cancelled] : Order::TRACKED_STEPS
    {
      id: order.id,
      number: order.number,
      status: order.status,
      placedAt: time(order.placed_at),
      expectedAt: time(order.expected_at),
      deliveredAt: time(order.delivered_at),
      items: order.items.map { |item| { id: item.id, name: item.name, quantity: item.quantity, unitPrice: item.unit_price } },
      total: order.total,
      currency: "INR",
      address: {
        name: order.address["name"].to_s,
        line1: order.address["line1"].to_s,
        line2: order.address["line2"].presence,
        city: order.address["city"].to_s,
        pincode: order.address["pincode"].to_s
      },
      paymentMethod: order.payment_method,
      timeline: steps.map { |status| { status:, at: time(times[status]) } }
    }
  end

  def notification(item)
    { id: item.id, title: item.title, body: item.body, createdAt: time(item.created_at), read: item.read_at.present?, link: item.link }
  end
end
