import { useCallback, useEffect, useMemo, useState } from "react";
import { AnchorProvider, BN, Program, type Idl } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  useAnchorWallet,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { burnerContractIdl, faucetContractIdl, tokenContractIdl } from "./idl";
import "./App.css";

const RPC_URL = "https://api.devnet.solana.com";
const TOKEN_PROGRAM_ADDRESS = "d8Moyb74LyVmiJUaEjJrK7gVJ9UfJ39FyaeBLaD4jzu";
const FAUCET_PROGRAM_ADDRESS = "28jX1tPZKkahfcV4VJCG7GVJZdowSMXn168ihanac9cn";
const BURNER_PROGRAM_ADDRESS = "D7R4JgGKkB2wsDBnpnMEyiRr2RKbCZfMyuRqKfqyMWGR";

const TOKEN_PROGRAM_ID_PK = new PublicKey(TOKEN_PROGRAM_ADDRESS);
const FAUCET_PROGRAM_ID_PK = new PublicKey(FAUCET_PROGRAM_ADDRESS);
const BURNER_PROGRAM_ID_PK = new PublicKey(BURNER_PROGRAM_ADDRESS);

const tokenContractIdlWithAddress = { ...tokenContractIdl, address: TOKEN_PROGRAM_ADDRESS };
const faucetContractIdlWithAddress = { ...faucetContractIdl, address: FAUCET_PROGRAM_ADDRESS };
const burnerContractIdlWithAddress = { ...burnerContractIdl, address: BURNER_PROGRAM_ADDRESS };

const TOKEN_CONFIG_SEED = Buffer.from("config");
const FAUCET_CONFIG_SEED = Buffer.from("faucet_config");
const FAUCET_AUTHORITY_SEED = Buffer.from("faucet_authority");
const CLAIM_PROFILE_SEED = Buffer.from("claim_profile");
const BURNER_CONFIG_SEED = Buffer.from("burner_config");
const TOTAL_BURNED_SEED = Buffer.from("total_burned");

type TokenState = {
  mint: PublicKey;
  decimals: number;
  name: string;
  symbol: string;
  userAta: PublicKey;
  uiBalance: string;
};

const unwrapErrorMessage = (error: unknown): string => {
  if (!error) return "Неизвестная ошибка.";
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause instanceof Error && cause.message) {
      return `${error.message}: ${cause.message}`;
    }
    return error.message;
  }
  return String(error);
};

const parseUiToRaw = (value: string, decimals: number): bigint => {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Введите корректное число.");
  }
  const [whole, fraction = ""] = normalized.split(".");
  const fractionPadded = (fraction + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(`${whole}${fractionPadded}`.replace(/^0+(?=\d)/, "") || "0");
};

const rawToUi = (value: bigint, decimals: number): string => {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction.length ? `${whole}.${fraction}` : `${whole}`;
};

function App() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const anchorWallet = useAnchorWallet();

  const [token, setToken] = useState<TokenState | null>(null);
  const [totalBurned, setTotalBurned] = useState<string>("0");
  const [recipient, setRecipient] = useState("");
  const [transferAmount, setTransferAmount] = useState("1");
  const [burnAmount, setBurnAmount] = useState("1");
  const [status, setStatus] = useState("Подключите кошелек для работы с dApp.");
  const [busy, setBusy] = useState(false);

  const provider = useMemo(() => {
    if (!anchorWallet) return null;
    return new AnchorProvider(connection, anchorWallet, { commitment: "confirmed" });
  }, [connection, anchorWallet]);

  const refreshState = useCallback(async () => {
    if (!provider || !publicKey) return;

    const tokenProgram = new Program(tokenContractIdlWithAddress as unknown as Idl, provider) as any;
    const faucetProgram = new Program(faucetContractIdlWithAddress as unknown as Idl, provider) as any;
    const burnerProgram = new Program(burnerContractIdlWithAddress as unknown as Idl, provider) as any;

    const [tokenConfigPda] = PublicKey.findProgramAddressSync(
      [TOKEN_CONFIG_SEED],
      TOKEN_PROGRAM_ID_PK
    );
    const tokenConfig = (await tokenProgram.account.tokenConfig.fetch(tokenConfigPda)) as {
      mint: PublicKey;
      name: string;
      symbol: string;
    };
    const mintState = await getMint(connection, tokenConfig.mint);
    const userAta = getAssociatedTokenAddressSync(tokenConfig.mint, publicKey);
    const userAtaInfo = await connection.getAccountInfo(userAta);
    const userBalance = userAtaInfo
      ? await connection.getTokenAccountBalance(userAta)
      : { value: { uiAmountString: "0" } };

    setToken({
      mint: tokenConfig.mint,
      decimals: mintState.decimals,
      name: tokenConfig.name,
      symbol: tokenConfig.symbol,
      userAta,
      uiBalance: userBalance.value.uiAmountString ?? "0",
    });

    const [burnStatsPda] = PublicKey.findProgramAddressSync(
      [TOTAL_BURNED_SEED],
      BURNER_PROGRAM_ID_PK
    );
    const burnStats = (await burnerProgram.account.burnStats.fetch(burnStatsPda).catch(() => null)) as
      | { amount: BN }
      | null;
    setTotalBurned(
      burnStats ? rawToUi(BigInt(burnStats.amount.toString()), mintState.decimals) : "0"
    );

    const [faucetConfigPda] = PublicKey.findProgramAddressSync(
      [FAUCET_CONFIG_SEED],
      FAUCET_PROGRAM_ID_PK
    );
    const faucetExists = await faucetProgram.account.faucetConfig.fetch(faucetConfigPda).catch(() => null);
    if (!faucetExists) {
      setStatus("Faucet еще не инициализирован в этой сети.");
    } else {
      setStatus("Данные обновлены.");
    }
  }, [connection, provider, publicKey]);

  useEffect(() => {
    refreshState().catch((e) => setStatus(`Ошибка обновления: ${String(e)}`));
  }, [refreshState]);

  const ensureAtaIx = useCallback(
    async (owner: PublicKey, mint: PublicKey, payer: PublicKey) => {
      const ata = getAssociatedTokenAddressSync(mint, owner);
      const info = await connection.getAccountInfo(ata);
      if (info) return { ata, ix: null as null | ReturnType<typeof createAssociatedTokenAccountInstruction> };
      return {
        ata,
        ix: createAssociatedTokenAccountInstruction(
          payer,
          ata,
          owner,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        ),
      };
    },
    [connection]
  );

  const onTransfer = useCallback(async () => {
    if (!publicKey || !token) return;
    setBusy(true);
    try {
      const recipientPk = new PublicKey(recipient.trim());
      const amountRaw = parseUiToRaw(transferAmount, token.decimals);
      if (amountRaw <= 0n) throw new Error("Сумма должна быть > 0.");

      const recipientAtaResult = await ensureAtaIx(recipientPk, token.mint, publicKey);
      const transferIx = createTransferCheckedInstruction(
        token.userAta,
        token.mint,
        recipientAtaResult.ata,
        publicKey,
        amountRaw,
        token.decimals,
        [],
        TOKEN_PROGRAM_ID
      );

      const tx = new Transaction();
      if (recipientAtaResult.ix) tx.add(recipientAtaResult.ix);
      tx.add(transferIx);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");
      setStatus(`Перевод выполнен: ${signature}`);
      await refreshState();
    } catch (e) {
      setStatus(`Ошибка перевода: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [connection, ensureAtaIx, publicKey, recipient, refreshState, sendTransaction, token, transferAmount]);

  const onRequestFaucet = useCallback(async () => {
    if (!provider || !publicKey || !token) return;
    setBusy(true);
    try {
      const faucetProgram = new Program(faucetContractIdlWithAddress as unknown as Idl, provider) as any;
      const [faucetConfigPda] = PublicKey.findProgramAddressSync([FAUCET_CONFIG_SEED], FAUCET_PROGRAM_ID_PK);
      const faucetConfig = (await faucetProgram.account.faucetConfig.fetch(faucetConfigPda)) as {
        mint: PublicKey;
        vault: PublicKey;
      };

      const ataResult = await ensureAtaIx(publicKey, token.mint, publicKey);
      if (ataResult.ix) {
        const ataTx = new Transaction().add(ataResult.ix);
        const ataSig = await sendTransaction(ataTx, connection);
        await connection.confirmTransaction(ataSig, "confirmed");
      }

      const [claimProfilePda] = PublicKey.findProgramAddressSync(
        [CLAIM_PROFILE_SEED, publicKey.toBuffer()],
        FAUCET_PROGRAM_ID_PK
      );
      const [faucetAuthorityPda] = PublicKey.findProgramAddressSync(
        [FAUCET_AUTHORITY_SEED],
        FAUCET_PROGRAM_ID_PK
      );

      const faucetTx = await faucetProgram.methods
        .requestTokens()
        .accountsPartial({
          user: publicKey,
          config: faucetConfigPda,
          claimProfile: claimProfilePda,
          mint: faucetConfig.mint,
          vault: faucetConfig.vault,
          userDestination: ataResult.ata,
          faucetAuthority: faucetAuthorityPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      faucetTx.feePayer = publicKey;
      faucetTx.recentBlockhash = (
        await connection.getLatestBlockhash("confirmed")
      ).blockhash;
      const signature = await sendTransaction(faucetTx, connection);
      await connection.confirmTransaction(signature, "confirmed");

      setStatus(`Faucet запрос выполнен: ${signature}`);
      await refreshState();
    } catch (e) {
      try {
        const faucetProgram = new Program(faucetContractIdlWithAddress as unknown as Idl, provider) as any;
        const [faucetConfigPda] = PublicKey.findProgramAddressSync(
          [FAUCET_CONFIG_SEED],
          FAUCET_PROGRAM_ID_PK
        );
        const faucetConfig = (await faucetProgram.account.faucetConfig.fetch(faucetConfigPda)) as {
          mint: PublicKey;
          vault: PublicKey;
        };
        const [claimProfilePda] = PublicKey.findProgramAddressSync(
          [CLAIM_PROFILE_SEED, publicKey.toBuffer()],
          FAUCET_PROGRAM_ID_PK
        );
        const [faucetAuthorityPda] = PublicKey.findProgramAddressSync(
          [FAUCET_AUTHORITY_SEED],
          FAUCET_PROGRAM_ID_PK
        );
        const ata = getAssociatedTokenAddressSync(token.mint, publicKey);
        const ix = await faucetProgram.methods
          .requestTokens()
          .accountsPartial({
            user: publicKey,
            config: faucetConfigPda,
            claimProfile: claimProfilePda,
            mint: faucetConfig.mint,
            vault: faucetConfig.vault,
            userDestination: ata,
            faucetAuthority: faucetAuthorityPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
        const simTx = new Transaction().add(ix);
        simTx.feePayer = publicKey;
        simTx.recentBlockhash = (
          await connection.getLatestBlockhash("confirmed")
        ).blockhash;
        const sim = await connection.simulateTransaction(simTx);
        const logs = sim.value.logs?.join(" | ") ?? "";
        setStatus(
          `Ошибка faucet: ${unwrapErrorMessage(e)}${logs ? ` | logs: ${logs}` : ""}`
        );
      } catch {
        setStatus(`Ошибка faucet: ${unwrapErrorMessage(e)}`);
      }
    } finally {
      setBusy(false);
    }
  }, [connection, ensureAtaIx, provider, publicKey, refreshState, sendTransaction, token]);

  const onBurn = useCallback(async () => {
    if (!provider || !publicKey || !token) return;
    setBusy(true);
    try {
      const amountRaw = parseUiToRaw(burnAmount, token.decimals);
      if (amountRaw <= 0n) throw new Error("Сумма сжигания должна быть > 0.");

      const burnerProgram = new Program(burnerContractIdlWithAddress as unknown as Idl, provider) as any;
      const [burnerConfigPda] = PublicKey.findProgramAddressSync(
        [BURNER_CONFIG_SEED],
        BURNER_PROGRAM_ID_PK
      );
      const [totalBurnedPda] = PublicKey.findProgramAddressSync(
        [TOTAL_BURNED_SEED],
        BURNER_PROGRAM_ID_PK
      );

      const burnTx = await burnerProgram.methods
        .burnTokens(new BN(amountRaw.toString()))
        .accountsPartial({
          user: publicKey,
          config: burnerConfigPda,
          totalBurned: totalBurnedPda,
          mint: token.mint,
          userTokenAccount: token.userAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .transaction();

      burnTx.feePayer = publicKey;
      burnTx.recentBlockhash = (
        await connection.getLatestBlockhash("confirmed")
      ).blockhash;
      const signature = await sendTransaction(burnTx, connection);
      await connection.confirmTransaction(signature, "confirmed");

      setStatus(`Токены сожжены: ${signature}`);
      await refreshState();
    } catch (e) {
      setStatus(`Ошибка burn: ${unwrapErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }, [burnAmount, provider, publicKey, refreshState, token]);

  return (
    <main className="container">
      <header className="header">
        <div>
          <h1>Solana FP Token dApp</h1>
          <p className="muted">RPC: {RPC_URL}</p>
        </div>
        <WalletMultiButton />
      </header>

      <section className="card">
        <h2>Баланс токена</h2>
        {!publicKey && <p>Подключи Phantom для продолжения.</p>}
        {publicKey && token && (
          <>
            <p>
              Токен: <b>{token.name}</b> ({token.symbol})
            </p>
            <p>Mint: {token.mint.toBase58()}</p>
            <p>Твой баланс: {token.uiBalance}</p>
          </>
        )}
      </section>

      <section className="card">
        <h2>Перевод токенов</h2>
        <input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Recipient wallet address"
        />
        <input
          value={transferAmount}
          onChange={(e) => setTransferAmount(e.target.value)}
          placeholder="Amount"
        />
        <button disabled={!publicKey || !token || busy} onClick={onTransfer}>
          Отправить
        </button>
      </section>

      <section className="card grid">
        <div>
          <h2>Faucet</h2>
          <button disabled={!publicKey || !token || busy} onClick={onRequestFaucet}>
            Запросить токены
          </button>
          <p className="muted">Лимит: 1 запрос в 24 часа.</p>
        </div>

        <div>
          <h2>Burner</h2>
          <input
            value={burnAmount}
            onChange={(e) => setBurnAmount(e.target.value)}
            placeholder="Burn amount"
          />
          <button disabled={!publicKey || !token || busy} onClick={onBurn}>
            Сжечь токены
          </button>
          <p>Total burned: {totalBurned}</p>
        </div>
      </section>

      <section className="card">
        <button disabled={busy} onClick={() => refreshState()}>
          Обновить данные
        </button>
        <p className="status">{status}</p>
      </section>
    </main>
  );
}

export default App;
