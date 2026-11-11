ARG RUBY_VERSION=3.3.10
FROM ruby:${RUBY_VERSION}-slim AS base

ENV BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_GEMFILE=/usr/local/bundle/Gemfile \
    BUNDLE_JOBS=4 \
    BUNDLE_RETRY=3 \
    RAILS_ENV=production

WORKDIR /app
RUN apt-get update -qq \
    && apt-get install --no-install-recommends -y libpq5 \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build
RUN apt-get update -qq \
    && apt-get install --no-install-recommends -y build-essential git libpq-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*
COPY Gemfile Gemfile.lock ./
# Gemfile.lock pins every gem version; a frozen install fails rather than
# quietly picking different versions.
RUN mkdir -p /usr/local/bundle \
    && cp Gemfile Gemfile.lock /usr/local/bundle/ \
    && BUNDLE_FROZEN=true bundle install
COPY . .

FROM base AS runtime
COPY --from=build /usr/local/bundle /usr/local/bundle
COPY --from=build /app /app
RUN groupadd --system rails \
    && useradd --system --gid rails --home-dir /app --shell /usr/sbin/nologin rails \
    && mkdir -p /app/tmp /app/log \
    && chown -R rails:rails /app /usr/local/bundle
USER rails:rails
EXPOSE 3000
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]

