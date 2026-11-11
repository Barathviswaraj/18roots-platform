AuthenticatedActor = Struct.new(:role, :subject, keyword_init: true) do
  def service?
    role == "service"
  end
end

