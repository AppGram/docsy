defmodule Greeter do
  @moduledoc """
  Build personalized greetings without network access.

  ## Examples

      iex> Greeter.greet("Docsy")
      "Hello, Docsy"
  """
  @doc """
  Greet a reader.

  ## Examples

      iex> Greeter.greet("Ada")
      "Hello, Ada"
  """
  @spec greet(String.t()) :: String.t()
  def greet(name), do: "Hello, " <> name
  @doc """
  Greet several readers while preserving input order.

  ## Examples

      iex> Greeter.greet_many(["Ada", "Linus"])
      ["Hello, Ada", "Hello, Linus"]
  """
  @spec greet_many([String.t()]) :: [String.t()]
  def greet_many(names), do: Enum.map(names, &greet/1)
  @doc """
  Reject an empty reader name. Raises `ArgumentError` when name is empty.

  ## Examples

      iex> Greeter.greet_checked("Ada")
      "Hello, Ada"
  """
  @spec greet_checked(String.t()) :: String.t()
  def greet_checked("") do
    raise ArgumentError, "Name must not be empty"
  end
  def greet_checked(name), do: greet(name)
end
