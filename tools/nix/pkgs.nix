arg:
let
  repo = "https://github.com/NixOS/nixpkgs";
  rev = "716c7a2664ca8325617b8a7fbb609273f2c4cae7";
  nixpkgs = import (builtins.fetchTarball {
    url = "${repo}/archive/${rev}.tar.gz";
    sha256 = "1h58jqnp6vjwmwbzxfphk60akw8higy8fsn9xk4zfk41v7aikdyd";
  }) arg;
in
nixpkgs
