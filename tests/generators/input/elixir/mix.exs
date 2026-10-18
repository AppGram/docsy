defmodule Greeter.MixProject do
  use Mix.Project
  def project, do: [app: :greeter, version: "1.0.0", elixir: "~> 1.14", deps: [{:ex_doc, "0.34.2", only: :dev, runtime: false}]]
  def application, do: []
end
