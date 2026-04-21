export type Signal402Protocol = {
  "version": "0.1.0";
  "name": "signal402_protocol";
  "address": "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS";
  "metadata": {
    "name": "signal402_protocol";
    "version": "0.1.0";
    "spec": "0.1.0";
    "description": "Signal402 Trust Layer - Verifiable sports betting predictions on Solana"
  };
  "instructions": [
    {
      "name": "commitPrediction";
      "accounts": [
        {
          "name": "prediction";
          "isMut": true;
          "isSigner": false;
        },
        {
          "name": "oracle";
          "isMut": true;
          "isSigner": true;
        },
        {
          "name": "systemProgram";
          "isMut": false;
          "isSigner": false;
        }
      ];
      "args": [
        {
          "name": "commitmentHash";
          "type": {
            "array": ["u8", 32];
          };
        },
        {
          "name": "matchId";
          "type": "string";
        },
        {
          "name": "expiryTimestamp";
          "type": "i64";
        }
      ];
    },
    {
      "name": "revealPrediction";
      "accounts": [
        {
          "name": "prediction";
          "isMut": true;
          "isSigner": false;
        },
        {
          "name": "oracle";
          "isMut": false;
          "isSigner": true;
        }
      ];
      "args": [
        {
          "name": "predictionData";
          "type": "string";
        },
        {
          "name": "nonce";
          "type": "u64";
        }
      ];
    },
    {
      "name": "initializeProtocol";
      "accounts": [
        {
          "name": "protocolState";
          "isMut": true;
          "isSigner": false;
        },
        {
          "name": "authority";
          "isMut": true;
          "isSigner": true;
        },
        {
          "name": "systemProgram";
          "isMut": false;
          "isSigner": false;
        }
      ];
      "args": [];
    },
    {
      "name": "registerOracle";
      "accounts": [
        {
          "name": "protocolState";
          "isMut": true;
          "isSigner": false;
        },
        {
          "name": "authority";
          "isMut": false;
          "isSigner": true;
        }
      ];
      "args": [
        {
          "name": "oraclePubkey";
          "type": "publicKey";
        }
      ];
    },
    {
      "name": "verifyPrediction";
      "accounts": [
        {
          "name": "prediction";
          "isMut": false;
          "isSigner": false;
        }
      ];
      "args": [
        {
          "name": "predictionData";
          "type": "string";
        },
        {
          "name": "nonce";
          "type": "u64";
        }
      ];
      "returns": "bool";
    }
  ];
  "accounts": [
    {
      "name": "prediction";
      "type": {
        "kind": "struct";
        "fields": [
          {
            "name": "oracle";
            "type": "publicKey";
          },
          {
            "name": "commitmentHash";
            "type": {
              "array": ["u8", 32];
            };
          },
          {
            "name": "matchId";
            "type": "string";
          },
          {
            "name": "timestamp";
            "type": "i64";
          },
          {
            "name": "expiryTimestamp";
            "type": "i64";
          },
          {
            "name": "isRevealed";
            "type": "bool";
          },
          {
            "name": "revealedData";
            "type": {
              "option": "string";
            };
          },
          {
            "name": "bump";
            "type": "u8";
          }
        ];
      };
    },
    {
      "name": "protocolState";
      "type": {
        "kind": "struct";
        "fields": [
          {
            "name": "authority";
            "type": "publicKey";
          },
          {
            "name": "predictionCount";
            "type": "u64";
          },
          {
            "name": "verifiedOracles";
            "type": {
              "vec": "publicKey";
            };
          },
          {
            "name": "bump";
            "type": "u8";
          }
        ];
      };
    }
  ];
  "events": [
    {
      "name": "PredictionCommitted";
      "fields": [
        {
          "name": "oracle";
          "type": "publicKey";
          "index": false;
        },
        {
          "name": "matchId";
          "type": "string";
          "index": false;
        },
        {
          "name": "commitmentHash";
          "type": {
            "array": ["u8", 32];
          };
          "index": false;
        },
        {
          "name": "timestamp";
          "type": "i64";
          "index": false;
        }
      ];
    },
    {
      "name": "PredictionRevealed";
      "fields": [
        {
          "name": "oracle";
          "type": "publicKey";
          "index": false;
        },
        {
          "name": "matchId";
          "type": "string";
          "index": false;
        },
        {
          "name": "predictionData";
          "type": "string";
          "index": false;
        },
        {
          "name": "nonce";
          "type": "u64";
          "index": false;
        },
        {
          "name": "timestamp";
          "type": "i64";
          "index": false;
        }
      ];
    },
    {
      "name": "ProtocolInitialized";
      "fields": [
        {
          "name": "authority";
          "type": "publicKey";
          "index": false;
        },
        {
          "name": "timestamp";
          "type": "i64";
          "index": false;
        }
      ];
    },
    {
      "name": "OracleRegistered";
      "fields": [
        {
          "name": "oracle";
          "type": "publicKey";
          "index": false;
        },
        {
          "name": "registeredBy";
          "type": "publicKey";
          "index": false;
        }
      ];
    },
    {
      "name": "PredictionVerified";
      "fields": [
        {
          "name": "oracle";
          "type": "publicKey";
          "index": false;
        },
        {
          "name": "matchId";
          "type": "string";
          "index": false;
        },
        {
          "name": "isValid";
          "type": "bool";
          "index": false;
        },
        {
          "name": "timestamp";
          "type": "i64";
          "index": false;
        }
      ];
    }
  ];
  "errors": [
    {
      "code": 6000;
      "name": "InvalidExpiry";
      "msg": "Prediction expiry must be in the future";
    },
    {
      "code": 6001;
      "name": "ExpiryTooFar";
      "msg": "Prediction expiry too far in the future";
    },
    {
      "code": 6002;
      "name": "PredictionNotExpired";
      "msg": "Prediction has not yet expired";
    },
    {
      "code": 6003;
      "name": "AlreadyRevealed";
      "msg": "Prediction already revealed";
    },
    {
      "code": 6004;
      "name": "InvalidRevelation";
      "msg": "Invalid revelation - hash mismatch";
    },
    {
      "code": 6005;
      "name": "NotYetRevealed";
      "msg": "Prediction not yet revealed";
    },
    {
      "code": 6006;
      "name": "Unauthorized";
      "msg": "Unauthorized action";
    },
    {
      "code": 6007;
      "name": "OracleAlreadyRegistered";
      "msg": "Oracle already registered";
    }
  ];
};

export const IDL: Signal402Protocol = {
  "version": "0.1.0",
  "name": "signal402_protocol",
  "address": "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS",
  "metadata": {
    "name": "signal402_protocol",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Signal402 Trust Layer - Verifiable sports betting predictions on Solana"
  },
  "instructions": [
    {
      "name": "commitPrediction",
      "accounts": [
        {
          "name": "prediction",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "oracle",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "commitmentHash",
          "type": {
            "array": ["u8", 32]
          }
        },
        {
          "name": "matchId",
          "type": "string"
        },
        {
          "name": "expiryTimestamp",
          "type": "i64"
        }
      ]
    },
    {
      "name": "revealPrediction",
      "accounts": [
        {
          "name": "prediction",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "oracle",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "predictionData",
          "type": "string"
        },
        {
          "name": "nonce",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeProtocol",
      "accounts": [
        {
          "name": "protocolState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "registerOracle",
      "accounts": [
        {
          "name": "protocolState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "oraclePubkey",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "verifyPrediction",
      "accounts": [
        {
          "name": "prediction",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "predictionData",
          "type": "string"
        },
        {
          "name": "nonce",
          "type": "u64"
        }
      ],
      "returns": "bool"
    }
  ],
  "accounts": [
    {
      "name": "prediction",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oracle",
            "type": "publicKey"
          },
          {
            "name": "commitmentHash",
            "type": {
              "array": ["u8", 32]
            }
          },
          {
            "name": "matchId",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "expiryTimestamp",
            "type": "i64"
          },
          {
            "name": "isRevealed",
            "type": "bool"
          },
          {
            "name": "revealedData",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "protocolState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "predictionCount",
            "type": "u64"
          },
          {
            "name": "verifiedOracles",
            "type": {
              "vec": "publicKey"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "PredictionCommitted",
      "fields": [
        {
          "name": "oracle",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "matchId",
          "type": "string",
          "index": false
        },
        {
          "name": "commitmentHash",
          "type": {
            "array": ["u8", 32]
          },
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "PredictionRevealed",
      "fields": [
        {
          "name": "oracle",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "matchId",
          "type": "string",
          "index": false
        },
        {
          "name": "predictionData",
          "type": "string",
          "index": false
        },
        {
          "name": "nonce",
          "type": "u64",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "ProtocolInitialized",
      "fields": [
        {
          "name": "authority",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "OracleRegistered",
      "fields": [
        {
          "name": "oracle",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "registeredBy",
          "type": "publicKey",
          "index": false
        }
      ]
    },
    {
      "name": "PredictionVerified",
      "fields": [
        {
          "name": "oracle",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "matchId",
          "type": "string",
          "index": false
        },
        {
          "name": "isValid",
          "type": "bool",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidExpiry",
      "msg": "Prediction expiry must be in the future"
    },
    {
      "code": 6001,
      "name": "ExpiryTooFar",
      "msg": "Prediction expiry too far in the future"
    },
    {
      "code": 6002,
      "name": "PredictionNotExpired",
      "msg": "Prediction has not yet expired"
    },
    {
      "code": 6003,
      "name": "AlreadyRevealed",
      "msg": "Prediction already revealed"
    },
    {
      "code": 6004,
      "name": "InvalidRevelation",
      "msg": "Invalid revelation - hash mismatch"
    },
    {
      "code": 6005,
      "name": "NotYetRevealed",
      "msg": "Prediction not yet revealed"
    },
    {
      "code": 6006,
      "name": "Unauthorized",
      "msg": "Unauthorized action"
    },
    {
      "code": 6007,
      "name": "OracleAlreadyRegistered",
      "msg": "Oracle already registered"
    }
  ]
};
