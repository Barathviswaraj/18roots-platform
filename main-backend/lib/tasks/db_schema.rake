namespace :db do
  desc "Create the PostgreSQL schema named by DB_SCHEMA, if it is missing"
  task ensure_schema: :environment do
    schema = ENV.fetch("DB_SCHEMA", "public")
    connection = ActiveRecord::Base.connection
    connection.execute("CREATE SCHEMA IF NOT EXISTS #{connection.quote_table_name(schema)}")
    puts "Database schema #{schema} is ready"
  end
end
