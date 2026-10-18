FROM mcr.microsoft.com/dotnet/sdk:8.0-bookworm-slim
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 HEX_CACERTS_PATH=/etc/ssl/certs/ca-certificates.crt
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl doxygen elixir erlang-dev php-cli php-mbstring php-xml lua-ldoc \
    && rm -rf /var/lib/apt/lists/*
RUN dotnet tool install docfx --version 2.78.3 --tool-path /tools
RUN curl -fL https://phpdoc.org/phpDocumentor.phar -o /tools/phpDocumentor.phar \
    && php /tools/phpDocumentor.phar --version
WORKDIR /work
