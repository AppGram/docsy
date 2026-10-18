// Package greeter is a native go doc fixture.
package greeter

// Greeter builds personalized greetings without network access.
//
// Usage:
//
//     g := Greeter{Prefix: "Welcome"}
//     fmt.Println(g.Greet("Docsy"))
type Greeter struct {
    // Prefix overrides the default salutation when non-empty.
    Prefix string
}

// Greet returns a friendly greeting for name.
//
// Usage:
//
//     greeting := Greeter{}.Greet("Ada")
func (g Greeter) Greet(name string) string { if g.Prefix != "" { return g.Prefix + ", " + name }; return "Hello, " + name }

// GreetMany greets several readers while preserving input order.
//
// Usage:
//
//     greetings := Greeter{}.GreetMany([]string{"Ada", "Linus"})
func (g Greeter) GreetMany(names []string) []string { result := make([]string, len(names)); for i, name := range names { result[i] = g.Greet(name) }; return result }

// Formatter describes a greeting provider.
type Formatter interface {
    // Greet creates a greeting for the named reader.
    Greet(name string) string
}
