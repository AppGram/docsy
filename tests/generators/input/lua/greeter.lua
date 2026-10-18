--- Build personalized greetings without network access.
-- @module greeter
local greeter = {}
--- Greet a reader.
-- @string name Reader name.
-- @treturn string A friendly greeting.
-- @usage
-- local greeter = require 'greeter'
-- print(greeter.greet('Docsy'))
function greeter.greet(name)
  return 'Hello, ' .. name
end
--- Greet several readers while preserving input order.
-- @tparam table names Reader names.
-- @string[opt=' / '] separator Separator between greetings.
-- @treturn string Joined greetings.
-- @usage
-- greeter.greet_many({'Ada', 'Linus'}, ' / ')
function greeter.greet_many(names, separator)
  local results = {}
  for i, name in ipairs(names) do results[i] = greeter.greet(name) end
  return table.concat(results, separator or ' / ')
end
--- Reject an empty reader name.
-- @string name Reader name.
-- @treturn string A validated greeting.
-- @raise When name is empty.
-- @usage greeter.greet_checked('Ada')
function greeter.greet_checked(name)
  assert(name ~= '', 'Name must not be empty')
  return greeter.greet(name)
end
return greeter
