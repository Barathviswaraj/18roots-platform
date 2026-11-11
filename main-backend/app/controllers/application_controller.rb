class ApplicationController < ActionController::API
  private

  def render_error(code, message, status)
    render json: { error: { code:, message: } }, status:
  end

  def json_body
    @json_body ||= begin
      JSON.parse(request.raw_post.presence || "{}")
    rescue JSON::ParserError
      raise ActionController::BadRequest, "Body is not valid JSON"
    end
  end
end
