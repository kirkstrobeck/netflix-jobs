# Reduce a command to its shell "skeleton": the characters the shell would
# treat as syntax, with quoted spans collapsed to the placeholder Q.
#
# A substring scan for ; | && $( on the raw command cannot tell syntax from
# text, so a payload like  docker exec c sh -c 'ps | sed'  reads as a pipeline
# when it is a single argument. Inside 'single quotes' nothing is live. Inside
# "double quotes" only $( and ` are.
#
# Reads the command on stdin, prints the skeleton on stdout. An unterminated
# quote yields a trailing ; so the caller treats it as chained rather than
# letting the swallowed remainder pass unseen.

NR > 1 { line = line "\n" }
{ line = line $0 }

END {
  n = length(line)
  state = "bare"
  out = ""

  for (i = 1; i <= n; i++) {
    c = substr(line, i, 1)

    if (state == "bare") {
      if (c == "\\") { i++; out = out "Q"; continue }
      if (c == "'") { state = "single"; out = out "Q"; continue }
      if (c == "\"") { state = "double"; out = out "Q"; continue }
      out = out c
      continue
    }

    if (state == "single") {
      if (c == "'") { state = "bare" }
      continue
    }

    # double: only command substitution survives
    if (c == "\\") { i++; continue }
    if (c == "\"") { state = "bare"; continue }
    if (c == "`") { out = out "`"; continue }
    if (c == "$" && substr(line, i + 1, 1) == "(") { out = out "$("; i++; continue }
  }

  if (state != "bare") { out = out ";" }
  print out
}
