#!/usr/bin/env python3
"""Generate a bcrypt hash for use in .env AUTH_PASSWORD."""

import sys
import bcrypt

if len(sys.argv) > 1:
    password = sys.argv[1]
else:
    import getpass
    password = getpass.getpass("Enter password to hash: ")

hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
print(f"\nPaste this into your .env file:\n")
print(f"AUTH_PASSWORD={hashed}")
