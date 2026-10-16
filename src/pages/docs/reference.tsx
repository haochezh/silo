import { PROGRAM_ID, PUMP_FEES_PROGRAM } from "../../lib/config";
import { A, C, Code, H2, H3, Note, OL, P, Table, UL } from "./ui";

export function SignatureScheme() {
  return (
    <>
      <P>
        silo uses a Winternitz one-time signature (WOTS) over SHA-256 with WOTS+-style tweaks. The same construction runs
        in the browser (<C>src/lib/wots.ts</C>) and in the program (<C>programs/silo/src/lib.rs</C>), so a signature made
        in the tab verifies on chain byte for byte.
      </P>

      <H2>Parameters</H2>
      <Table
        head={["Parameter", "Value", "Notes"]}
        rows={[
          [<C>w</C>, "256", "Each chain has 255 hash steps; one digit is one byte."],
          [<C>n</C>, "28 bytes", "Chain values are SHA-256 outputs truncated to 224 bits."],
          ["Message digits", "28", "The first 28 bytes of SHA-256(message)."],
          ["Checksum digits", "2", "Σ(255 − dᵢ) over the message digits, big-endian. Max 7,140."],
          ["Chains", "30", "28 + 2."],
          ["Signature", "840 bytes", "30 × 28."],
          ["Public key", "32 bytes", "SHA-256 of the 30 chain ends, concatenated."],
          ["Verify budget", "≤ 3,600 steps", "Enforced on chain; the signer grinds a salt to stay under it."],
        ]}
      />

      <H2>Hashing</H2>
      <P>
        One step on chain <C>j</C> at position <C>k</C> prefixes the two bytes <C>[j, k]</C> before hashing. The tweak
        means a value found on one chain or position is useless anywhere else, which closes the multi-target attacks that
        affect plain Winternitz.
      </P>
      <Code lang="text" title="primitives">{`
step(x, j, k)          = SHA256(u8(j) || u8(k) || x)[0..28]
walk(x, j, from, n)    = step(...step(step(x, j, from), j, from+1)..., j, from+n-1)
digits(m)              = d[0..28] = SHA256(m)[0..28]
                         c = Σ (255 - d[i])         // 0..7140
                         d[28] = c >> 8, d[29] = c & 0xff
`}</Code>

      <H2>Signing and verifying</H2>
      <Code lang="text" title="sign / verify">{`
sign(sk, m):
  d = digits(m)
  σ[j] = walk(sk[j], j, 0, d[j])                      for j in 0..30
  return σ[0] || ... || σ[29]                          // 840 bytes

verify(σ, m, key_hash):
  d = digits(m)
  pk'[j] = walk(σ[j], j, d[j], 255 - d[j])             for j in 0..30
  return SHA256(pk'[0] || ... || pk'[29]) == key_hash
`}</Code>
      <P>
        The checksum is what makes forgery impossible without inverting SHA-256: increasing any message digit (walking a
        chain further, which anyone can do) necessarily decreases the checksum, which would require walking a checksum
        chain backwards.
      </P>

      <H2>Message layout</H2>
      <P>Withdrawals are encoded as a flat byte string. Public keys are included as their base58 text.</P>
      <Table
        head={["Field", "Encoding", "Size"]}
        rows={[
          ["Domain tag", <C>"silo/withdraw/v1"</C>, "16 bytes"],
          ["Program ID", "base58 UTF-8", "32–44 bytes"],
          ["Silo address", "base58 UTF-8", "32–44 bytes"],
          ["Key index", "u32, little-endian", "4 bytes"],
          ["Kind", "u8 (0 = SOL, 1 = token)", "1 byte"],
          ["Mint", "base58 UTF-8", "32–44 bytes"],
          ["Amount", "u64, little-endian; u64::MAX = everything above rent", "8 bytes"],
          ["Destination", "base58 UTF-8", "32–44 bytes"],
          ["Next key hash", "raw", "32 bytes"],
          ["Salt", "u32, little-endian", "4 bytes"],
        ]}
      />

      <H2>Salt grinding</H2>
      <P>
        Verification costs <C>Σ(255 − dⱼ)</C> hash steps across the 30 chains, which averages about 3,825. The program
        rejects anything above 3,600 so the check always fits in one transaction. The signer increments the salt until a
        message lands under the bound; on average this takes a few attempts and adds no security cost, because the salt
        is part of the signed message.
      </P>

      <H2>Security level</H2>
      <P>
        Forging requires a second preimage or preimage of the truncated 224-bit hash. Grover's algorithm reduces this to
        roughly 2¹¹² quantum operations. Shor's algorithm, which breaks ed25519, has no structure to work with here.
      </P>
    </>
  );
}

export function ProgramReference() {
  return (
    <>
      <P>
        The silo program is written with Anchor. Program ID: <C>{PROGRAM_ID}</C>.
      </P>

      <H2>Instructions</H2>
      <H3>open_silo</H3>
      <P>Creates a silo committed to the hash of key #0.</P>
      <Table
        head={["Account", "Writable", "Signer", "Description"]}
        rows={[
          [<C>silo</C>, "yes", "no", <>PDA, seeds <C>["silo", first_key_hash]</C></>],
          [<C>payer</C>, "yes", "yes", "Pays rent"],
          [<C>system_program</C>, "no", "no", "System program"],
        ]}
      />
      <Code lang="rust" title="args">{`first_key_hash: [u8; 32]`}</Code>

      <H3>authorize</H3>
      <P>
        Verifies a WOTS signature over an action, checks the verification budget, rotates the silo to the committed next
        key and stores the action as pending. Permissionless.
      </P>
      <Table
        head={["Account", "Writable", "Signer", "Description"]}
        rows={[[<C>silo</C>, "yes", "no", "The silo being withdrawn from"]]}
      />
      <Code lang="rust" title="args">{`
sig: Vec<u8>   // exactly 840 bytes
action: Action
salt: u32
`}</Code>

      <H3>execute_sol</H3>
      <P>
        Pays out the pending SOL action. Fails unless <C>destination</C> equals the signed destination. When the signed
        amount is <C>u64::MAX</C>, pays everything above the rent-exempt minimum. Permissionless.
      </P>
      <Table
        head={["Account", "Writable", "Signer", "Description"]}
        rows={[
          [<C>silo</C>, "yes", "no", "The silo"],
          [<C>destination</C>, "yes", "no", "Must match the signed destination"],
        ]}
      />

      <H3>execute_token</H3>
      <P>
        Same shape as <C>execute_sol</C> for SPL quote tokens on non-SOL-paired coins. Transfers from the silo's associated
        token account with a PDA signature.
      </P>

      <H2>Accounts</H2>
      <Code lang="rust" title="Silo · 195 bytes">{`
pub struct Silo {
    pub first_key_hash: [u8; 32],
    pub key_hash: [u8; 32],      // current key
    pub key_index: u32,
    pub pending: Option<Action>,
    pub total_out: u64,
    pub bump: u8,
}

pub struct Action {
    pub key_index: u32,
    pub kind: Kind,              // Sol | Token
    pub mint: Pubkey,
    pub amount: u64,             // u64::MAX = everything above rent
    pub destination: Pubkey,
    pub next_key_hash: [u8; 32],
}
`}</Code>

      <H2>Errors</H2>
      <Table
        head={["Code", "Name", "Meaning"]}
        rows={[
          ["6000", <C>BadSignatureLength</C>, "Signature is not exactly 840 bytes"],
          ["6001", <C>ActionPending</C>, "An approved action is waiting to execute"],
          ["6002", <C>WrongKey</C>, "Signed with a key index other than the silo's current one"],
          ["6003", <C>TooMuchWork</C>, "Verification would exceed 3,600 steps; grind a new salt"],
          ["6004", <C>InvalidSignature</C>, "Signature does not match the silo's current key"],
          ["6005", <C>NothingPending</C>, "No approved action to execute"],
          ["6006", <C>WrongKind</C>, "Execute instruction does not match the action kind"],
          ["6007", <C>WrongDestination</C>, "Destination account differs from the signed destination"],
          ["6008", <C>Insufficient</C>, "Not enough balance above rent"],
        ]}
      />

      <H2>Compute</H2>
      <P>
        <C>authorize</C> uses the <C>sol_sha256</C> syscall for every step. A signature at the 3,600-step bound verifies in
        roughly 600,000 to 700,000 compute units. Request a compute budget of 1,000,000 to leave headroom.
      </P>
    </>
  );
}

export function Sdk() {
  return (
    <>
      <P>
        The browser client lives in <C>src/lib/wots.ts</C>. It has no Solana dependency and can be used in any
        JavaScript runtime that supports <C>@noble/hashes</C> and <C>@scure/bip39</C>.
      </P>

      <H2>Example</H2>
      <Code lang="ts" title="withdraw.ts">{`
import { seedFrom, deriveKey, grindSalt, encodeWithdrawal, sign, verify } from "./lib/wots";

const seed = seedFrom(words);                       // 24 words, never sent anywhere
const key  = deriveKey(seed, keyIndex);             // current one-time key
const next = deriveKey(seed, keyIndex + 1);         // the silo rotates to this

const base = {
  program, vault, keyIndex,
  kind: "sol" as const,
  mint: "So11111111111111111111111111111111111111112",
  amount: 500_000_000n,                             // 0.5 SOL
  destination,
  nextKeyHash: next.pkHash,
};

const { salt } = grindSalt(base);                   // keep verify work <= 3,600
const msg = encodeWithdrawal({ ...base, salt });
const sig = sign(key, msg);                         // Uint8Array(840)

console.log(verify(sig, msg, key.pkHash).ok);       // true
`}</Code>

      <H2>Functions</H2>
      <Table
        head={["Function", "Returns", "Description"]}
        rows={[
          [<C>newMnemonic()</C>, "string", "Generates a 24-word BIP-39 phrase (256 bits of entropy)."],
          [<C>isMnemonic(words)</C>, "boolean", "Validates a phrase against the English wordlist and checksum."],
          [<C>seedFrom(words)</C>, "Uint8Array(64)", <>BIP-39 seed with the fixed passphrase <C>silo/v1</C>.</>],
          [<C>deriveKey(seed, i)</C>, "KeyPair", "Derives one-time key i: 30 secret values, 30 chain ends and the 32-byte key hash."],
          [<C>encodeWithdrawal(w)</C>, "Uint8Array", "Encodes a withdrawal into the exact bytes the program signs over."],
          [<C>grindSalt(w)</C>, "{ salt, digits, tries }", "Finds the first salt whose verification work is within budget."],
          [<C>sign(key, msg)</C>, "Uint8Array(840)", "Produces the WOTS signature."],
          [<C>verify(sig, msg, keyHash)</C>, "VerifyTrace", "Re-walks the chains and returns ok, digits, hash count, recomputed key and timing."],
          [<C>digits(msg)</C>, "number[30]", "Message digits plus checksum."],
        ]}
      />

      <H2>Types</H2>
      <Code lang="ts" title="types">{`
type KeyPair = {
  index: number;
  sk: Uint8Array[];      // 30 × 28 bytes, secret
  pk: Uint8Array[];      // 30 × 28 bytes, chain ends
  pkHash: Uint8Array;    // 32 bytes, what the silo stores
};

type Withdrawal = {
  program: string;
  vault: string;
  keyIndex: number;
  kind: "sol" | "token";
  mint: string;
  amount: bigint;
  destination: string;
  nextKeyHash: Uint8Array;
  salt: number;
};
`}</Code>

      <Note kind="warn">
        Never call <C>sign</C> twice with the same key on different messages. The client always signs with the silo's
        current key index, and the program rotates the key in the same instruction that verifies it.
      </Note>
    </>
  );
}

export function PumpIntegration() {
  return (
    <>
      <P>
        silo does not wrap, fork or replace pump.fun. It uses pump.fun's public fee sharing instructions to make a silo
        the recipient of a coin's creator fees. Trading, the bonding curve, graduation and PumpSwap all keep working
        exactly as before; the only thing that changes is where the creator's share of each trade ends up.
      </P>

      <H2>How pump.fun pays creators</H2>
      <P>
        Every trade on a pump.fun coin pays a small creator fee on top of the protocol fee. On the bonding curve, that fee
        accrues in a creator vault PDA owned by the Pump program, seeded by <C>["creator-vault", creator]</C>. After a coin
        graduates, trades happen on PumpSwap, which keeps its own coin creator vault. Fees are collected in the pool's
        quote asset, so SOL-paired coins pay creators in SOL, never in the coin itself.
      </P>
      <P>
        For a coin with a single creator recipient, the creator claims those fees with <C>collect_creator_fee_v2</C>, which
        sends them to the creator's wallet. That wallet is an ordinary ed25519 key, which is the part silo replaces.
      </P>

      <H2>Fee sharing</H2>
      <P>
        pump.fun's fee sharing lets a creator move a coin's creator vault into a sharing config and split fees between up
        to ten shareholders, each with a share in basis points. Two properties matter for silo:
      </P>
      <UL>
        <li><strong className="text-ink font-normal">It is configured once.</strong> The split can be set a single time; afterwards the config's admin is revoked and the recipients are fixed for good.</li>
        <li><strong className="text-ink font-normal">Distribution is permissionless.</strong> Anyone can call the instruction that pays accrued fees out to the shareholders, so recipients never need to sign anything to receive.</li>
      </UL>
      <P>
        Together these give silo what it needs: a permanent route that cannot be redirected, and a way for fees to arrive
        without any ed25519 signature from the recipient.
      </P>

      <H2>Programs</H2>
      <Table
        head={["Program", "Role in silo"]}
        rows={[
          ["Pump", "Bonding curve. Holds the creator vault PDA and pays out sharing configs with distribute_creator_fees_v2."],
          ["PumpSwap", "AMM for graduated coins. Holds the coin creator vault; transfer_creator_fees_to_pump_v2 moves its fees back for distribution."],
          [<>Pump Fees <C>{PUMP_FEES_PROGRAM}</C></>, "Creates sharing configs and stores shareholders and their basis points."],
          [<>silo <C>{PROGRAM_ID}</C></>, "Owns the silo PDA that is set as a shareholder, and releases funds only to valid WOTS signatures."],
        ]}
      />

      <H2>Instructions used</H2>
      <Table
        head={["Instruction", "Program", "Who calls it", "When"]}
        rows={[
          [<C>create_fee_sharing_config</C>, "Pump Fees", "Creator", "Once, during lock. Migrates the creator vault (and the PumpSwap coin creator, if graduated) to a sharing config PDA."],
          [<C>update_fee_shares_v2</C>, "Pump Fees", "Creator", "Once, during lock. Sets the silo, and the creator for any remaining share, as shareholders. Sweeps pending fees first. Admin revoked afterwards."],
          [<C>transfer_creator_fees_to_pump_v2</C>, "PumpSwap", "Anyone", "Graduated coins: moves fees accrued on the AMM into the bonding curve's creator vault."],
          [<C>distribute_creator_fees_v2</C>, "Pump", "Anyone", "Any time fees have accrued. Pays each shareholder according to its basis points."],
        ]}
      />

      <H2>The lock, step by step</H2>
      <OL>
        <li>The browser derives key #0 from your 24 words and computes the silo address from its hash.</li>
        <li><C>open_silo</C> creates the silo account, committing to that hash.</li>
        <li><C>create_fee_sharing_config</C> migrates the coin's creator vault to a sharing config.</li>
        <li><C>update_fee_shares_v2</C> sets the shareholders: the silo gets your chosen share in basis points (100% is 10,000 bps), and the creator wallet gets the rest, if any. pump.fun then revokes the admin.</li>
        <li><C>distribute_creator_fees_v2</C> sweeps anything already pending into the silo.</li>
      </OL>
      <Note>
        Steps 2 to 4 are signed by the creator wallet in one go. After step 4, the creator wallet has no remaining power
        over the route; it is just another shareholder if you chose less than 100%.
      </Note>

      <H2>Keeping fees flowing</H2>
      <P>
        Because distribution is permissionless, fees do not need you to come back. silo runs a crank that calls
        <C> distribute_creator_fees_v2</C> for locked coins when accrued fees cross a small threshold, and anyone else can do
        the same. For graduated coins the crank first calls <C>transfer_creator_fees_to_pump_v2</C>. If the crank ever
        stops, nothing is lost: fees simply wait in pump.fun's vault until the next distribution.
      </P>

      <H2>Eligibility</H2>
      <UL>
        <li>The coin must still be single-recipient: its creator vault has not already been migrated to a sharing config.</li>
        <li>The signer must be the coin's current creator.</li>
        <li>The coin can be on the bonding curve or graduated to PumpSwap.</li>
        <li>SOL-paired and other-quote coins are both supported; non-SOL quotes are withdrawn with <C>execute_token</C>.</li>
      </UL>

      <H2>What changes for holders and traders</H2>
      <P>
        Nothing about trading changes. Fees are the same, the curve is the same, and graduation works as normal. What
        holders gain is a public, permanent guarantee about where the creator's share goes, which anyone can confirm on
        chain by reading the coin's sharing config and seeing the silo PDA as a shareholder.
      </P>
    </>
  );
}

export function Security() {
  return (
    <>
      <P>
        This page states what silo protects against, what it assumes, and where its protection ends. If anything here is
        unclear, assume the narrower reading.
      </P>

      <H2>What silo protects</H2>
      <UL>
        <li><strong className="text-ink font-normal">A broken ed25519.</strong> No step of a withdrawal depends on an elliptic curve. A quantum computer running Shor's algorithm, or a classical break, gains nothing against a silo.</li>
        <li><strong className="text-ink font-normal">Redirection.</strong> The fee route is fixed by pump.fun and cannot be changed by the creator or by silo.</li>
        <li><strong className="text-ink font-normal">Tampering.</strong> Every byte of a withdrawal is signed. Anyone can submit it, nobody can alter it.</li>
        <li><strong className="text-ink font-normal">Replay.</strong> Keys are one-time and rotate on chain in the same instruction that verifies them.</li>
      </UL>

      <H2>What silo assumes</H2>
      <UL>
        <li>SHA-256, truncated to 224 bits, is preimage and second-preimage resistant.</li>
        <li>The Solana runtime executes the program as written.</li>
        <li>The device you type your 24 words on is not compromised.</li>
      </UL>

      <H2>What silo does not protect</H2>
      <UL>
        <li>Solana's consensus. Validators sign with ed25519; a broken curve threatens the network itself.</li>
        <li>Upgrade authority. Until the program is made immutable, its upgrade key is an ed25519 key.</li>
        <li>Funds after withdrawal. A destination wallet is only as safe as its own key.</li>
        <li>The share of fees you chose not to route.</li>
        <li>Lost or stolen words.</li>
      </UL>

      <H2>Status</H2>
      <Note>
        silo is experimental software running on devnet. The program has not been audited. Do not lock a coin with
        meaningful fee volume until an audit has been published and the program has been made immutable.
      </Note>

      <H2>Reporting a vulnerability</H2>
      <P>
        Contact <A to="https://x.com/silodotfund">@silodotfund</A> by direct message and ask for a private channel.
        Please do not post details publicly until a fix is deployed.
      </P>
    </>
  );
}

export function Faq() {
  const qa: [string, string][] = [
    ["Is a quantum computer able to break Solana today?", "No. Current machines are far from the scale needed. The concern is that estimates keep falling and creator fees can sit untouched for years, so the vault should be safe for whenever that day comes."],
    ["Can I change the fee split after locking?", "No. pump.fun allows the split to be configured once and revokes the admin afterwards. This is what makes the route trustworthy to holders."],
    ["What if I lose my 24 words?", "The silo is sealed permanently. Fees will continue to arrive and nobody can move them."],
    ["Does silo take a fee?", "silo charges nothing to lock. Withdrawals cost only Solana transaction fees."],
    ["Why does a withdrawal need two transactions?", "The 840-byte signature nearly fills a transaction on its own. Splitting verification (authorize) from payout (execute) keeps each one within Solana's size and compute limits."],
    ["Can someone front-run my withdrawal?", "They can submit it for you, but it will pay exactly the signed amount to exactly the signed destination. Submitting it is a free favour."],
    ["Why base58 strings in the signed message?", "So the browser can build the message without a base58 decoder. A future version may switch to raw 32-byte keys to save compute; the domain tag will change with it."],
    ["Can I use the same words for two coins?", "No. Each lock generates a new phrase, and each phrase controls one silo."],
  ];
  return (
    <>
      {qa.map(([q, a]) => (
        <div key={q}>
          <H3>{q}</H3>
          <P>{a}</P>
        </div>
      ))}
    </>
  );
}
