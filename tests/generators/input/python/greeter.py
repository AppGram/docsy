"""A real Sphinx autodoc input module."""

class Greeter:
    """Build personalized greetings without network access.

    Example::

        greeter = Greeter()
        print(greeter.greet('Docsy'))
    """

    #: Greeting prefix used for future calls.
    prefix: str = 'Hello'

    def greet(self, name: str) -> str:
        """Greet a reader.

        :param name: Reader name.
        :type name: str
        :returns: A friendly greeting.
        :rtype: str

        Example::

            Greeter().greet('Docsy')
        """
        return f'{self.prefix}, {name}'

    def greet_many(self, names: list[str], separator: str = ' / ') -> str:
        """Greet several readers while preserving input order.

        :param names: Reader names.
        :param separator: Separator between greetings.
        :returns: Joined greetings.

        Example::

            Greeter().greet_many(['Ada', 'Linus'])
        """
        return separator.join(self.greet(name) for name in names)

    def greet_checked(self, name: str) -> str:
        """Reject an empty reader name.

        :param name: Reader name.
        :returns: A validated greeting.
        :raises ValueError: When name is empty.

        Example::

            Greeter().greet_checked('Ada')
        """
        if not name.strip():
            raise ValueError('Name must not be empty')
        return self.greet(name)
