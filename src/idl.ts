export const tokenContractIdl = {
  address: "3Eoy49pVjDBm4KArrTERpotuZmaAnouj5TyALW2ALcAw",
  metadata: {
    name: "token_contract",
    version: "0.1.0",
    spec: "0.1.0",
  },
  instructions: [],
  accounts: [{ name: "TokenConfig", discriminator: [92, 73, 255, 43, 107, 51, 117, 101] }],
  types: [
    {
      name: "TokenConfig",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "pubkey" },
          { name: "mint", type: "pubkey" },
          { name: "decimals", type: "u8" },
          { name: "bump", type: "u8" },
          { name: "mint_authority_bump", type: "u8" },
          { name: "metadata", type: "pubkey" },
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
        ],
      },
    },
  ],
} as const;

export const faucetContractIdl = {
  address: "28jX1tPZKkahfcV4VJCG7GVJZdowSMXn168ihanac9cn",
  metadata: {
    name: "faucet_contract",
    version: "0.1.0",
    spec: "0.1.0",
  },
  instructions: [
    {
      name: "request_tokens",
      discriminator: [97, 174, 219, 62, 9, 41, 113, 147],
      accounts: [
        { name: "user", writable: true, signer: true },
        { name: "config", writable: true },
        { name: "claim_profile", writable: true },
        { name: "mint", writable: true },
        { name: "vault", writable: true },
        { name: "user_destination", writable: true },
        { name: "faucet_authority" },
        { name: "token_program" },
        { name: "system_program" },
      ],
      args: [],
    },
  ],
  accounts: [
    { name: "ClaimProfile", discriminator: [121, 191, 203, 171, 181, 40, 207, 175] },
    { name: "FaucetConfig", discriminator: [216, 31, 49, 154, 106, 125, 143, 142] },
  ],
  types: [
    {
      name: "ClaimProfile",
      type: {
        kind: "struct",
        fields: [
          { name: "user", type: "pubkey" },
          { name: "last_request_ts", type: "i64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "FaucetConfig",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "pubkey" },
          { name: "mint", type: "pubkey" },
          { name: "vault", type: "pubkey" },
          { name: "amount_per_request", type: "u64" },
          { name: "bump", type: "u8" },
          { name: "authority_bump", type: "u8" },
        ],
      },
    },
  ],
} as const;

export const burnerContractIdl = {
  address: "D7R4JgGKkB2wsDBnpnMEyiRr2RKbCZfMyuRqKfqyMWGR",
  metadata: {
    name: "burner_contract",
    version: "0.1.0",
    spec: "0.1.0",
  },
  instructions: [
    {
      name: "burn_tokens",
      discriminator: [76, 15, 51, 254, 229, 215, 121, 66],
      accounts: [
        { name: "user", writable: true, signer: true },
        { name: "config" },
        { name: "total_burned", writable: true },
        { name: "mint", writable: true },
        { name: "user_token_account", writable: true },
        { name: "token_program" },
      ],
      args: [{ name: "amount", type: "u64" }],
    },
  ],
  accounts: [
    { name: "BurnStats", discriminator: [120, 252, 106, 79, 63, 181, 202, 100] },
    { name: "BurnerConfig", discriminator: [81, 233, 125, 144, 108, 145, 253, 133] },
  ],
  types: [
    {
      name: "BurnStats",
      type: {
        kind: "struct",
        fields: [
          { name: "amount", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "BurnerConfig",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "pubkey" },
          { name: "mint", type: "pubkey" },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
} as const;
