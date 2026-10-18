''' <summary>Build personalized greetings without network access.</summary>
''' <example><code>
''' Dim greeter As New Greeter()
''' Console.WriteLine(greeter.Greet("Docsy"))
''' </code></example>
Public Class Greeter
    ''' <summary>Greeting prefix used for future calls.</summary>
    Public Property Prefix As String = "Hello"
    ''' <summary>Greet a reader.</summary>
    ''' <param name="name">Reader name.</param>
    ''' <returns>A friendly greeting.</returns>
    ''' <example><code>New Greeter().Greet("Ada")</code></example>
    Public Function Greet(name As String) As String
        Return Prefix & ", " & name
    End Function
    ''' <summary>Greet several readers while preserving input order.</summary>
    ''' <param name="names">Reader names.</param>
    ''' <returns>Greetings in the same order.</returns>
    ''' <example><code>New Greeter().GreetMany({"Ada", "Linus"})</code></example>
    Public Function GreetMany(names As String()) As String()
        Return System.Array.ConvertAll(names, Function(name) Greet(name))
    End Function
    ''' <summary>Reject an empty reader name.</summary>
    ''' <param name="name">Reader name.</param>
    ''' <returns>A validated greeting.</returns>
    ''' <exception cref="System.ArgumentException">When name is empty.</exception>
    Public Function GreetChecked(name As String) As String
        If String.IsNullOrWhiteSpace(name) Then Throw New System.ArgumentException("Name must not be empty")
        Return Greet(name)
    End Function
End Class
