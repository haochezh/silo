import { PROGRAM_ID, PUMP_FEES_PROGRAM } from "../../lib/config";
import { A, C, Code, H2, H3, Note, OL, P, Steps, Table, UL } from "./ui";

export function Introduction() {
  return (
    <>
      <P>
        silo is a Solana program that holds pump.fun creator fees in vaults that have no private key. A coin's creator
        points its fee split at a silo once, through pump.fun's own fee sharing, and from then on every creator fee the
        coin earns flows into that vault. The only way to move funds out is a Winternitz one-time signature over SHA-256,
        made in the browser from 24 words and verified on chain. No elliptic curve is involved at any step of a
        withdrawal.
      </P>
      <P>
        The design goal is deliberately narrow: creator fees should survive the day ed25519 stops being safe, whether that
        day comes from a quantum computer running Shor's algorithm or from a classical break nobody has published yet.
        Everything else about silo, from the interface to the key derivation, follows from taking that goal seriously.
      </P>

      <H2>Why creator fees</H2>
      <P>
        On Solana an address <em>is</em> its ed25519 public key. Bitcoin hides most public keys behind a hash until coins
        move; Solana cannot, so every wallet's key is visible from the moment it receives anything. If the curve falls,
        every wallet is exposed at the same time, and there is no window in which a user can move funds first.
      </P>
      <P>
        Creator fees are the slowest money in the ecosystem. They accrue on every trade, sit in a creator vault until
        someone claims them, and are frequently left untouched for months or years. A coin that trades for a weekend can
        keep earning fees long after its creator has stopped watching it. That makes these balances exactly the money a
        future attacker reaches first: large, idle and protected by a key in plain sight.
      </P>
      <P>
        silo moves them somewhere the attack does not apply. A silo has no curve key at all, so there is nothing for Shor's
        algorithm to target, and the hash-based signature that guards it keeps roughly 112 bits of security even against
        Grover's search.
      </P>

      <H2>How silo works, in one paragraph</H2>
      <P>
        When you lock a coin, your browser generates 24 words and derives from them a chain of one-time keys. It
        publishes only the hash of key #0, which becomes part of the silo's address. pump.fun's fee sharing is then
        configured to pay the coin's creator fees to that address, and pump.fun revokes the configuration's admin so the
        route can never change. Fees are pushed into the silo by a permissionless instruction anyone can call. To withdraw,
        the browser signs the exact amount and destination with the current key, commits to the next key in the same
        signature, and the program checks every byte before paying out.
      </P>

      <H2>What silo is not</H2>
      <UL>
        <li><strong className="text-ink font-normal">Not a launchpad.</strong> silo works with coins that already exist on pump.fun, on the bonding curve or graduated to PumpSwap. You do not relaunch anything.</li>
        <li><strong className="text-ink font-normal">Not a wallet.</strong> You do not hold tokens in silo day to day. It is a destination for fees you intend to keep, possibly for a long time.</li>
        <li><strong className="text-ink font-normal">Not custodial.</strong> silo never sees your words and has no key that can move funds. There is no admin, no pause switch and no recovery path.</li>
        <li><strong className="text-ink font-normal">Not a fix for Solana itself.</strong> Validators still sign blocks with ed25519. silo protects what is inside a silo from a broken signing key; it does not make the network quantum-safe.</li>
      </UL>

      <H2>Who it is for</H2>
      <UL>
        <li>Creators who want their coin's fees to accumulate somewhere they will still be safe in five or ten years.</li>
        <li>Communities that want proof the creator cannot redirect fees later: the route is fixed by pump.fun and visible on chain.</li>
        <li>Anyone interested in practical post-quantum cryptography on Solana today, with a verifier they can run themselves.</li>
      </UL>

      <H2>Network status</H2>
      <Table
        head={["Item", "Value"]}
        rows={[
          ["Network", "Devnet"],
          ["silo program", <C>{PROGRAM_ID}</C>],
          ["Pump Fees program", <C>{PUMP_FEES_PROGRAM}</C>],
          ["Signature scheme", "Winternitz OTS, w = 256, SHA-256 truncated to 224 bits"],
          ["Signature size", "840 bytes"],
          ["Public API", <C>https://api.silo.fund/api</C>],
        ]}
      />

      <H2>Where to go next</H2>
      <UL>
        <li><A to="/docs/quickstart">Quickstart</A>: lock your first coin's fees in a few minutes.</li>
        <li><A to="/docs/concepts">Core concepts</A>: silos, one-time keys and the fee route.</li>
        <li><A to="/docs/pump-fun">pump.fun integration</A>: exactly which pump.fun instructions silo calls, and when.</li>
        <li><A to="/docs/signature-scheme">Signature scheme</A>: the exact construction, byte for byte.</li>
        <li><A to="/docs/security">Security model</A>: what silo protects, and what it does not.</li>
      </UL>
    </>
  );
}

export function Quickstart() {
  return (
    <>
      <P>
        This guide routes a pump.fun coin's creator fees into a new silo. It takes a few minutes and one wallet
        signature. You need the wallet that created the coin and somewhere safe to write down 24 words. Nothing in this
        guide requires installing software; everything happens on silo.fund in your browser.
      </P>

      <Note kind="warn" title="Read this first">
        pump.fun lets a coin's fee split be configured exactly once. After you lock, neither you nor silo can point the
        fees anywhere else. Only lock a coin when you are sure, and only after your 24 words are written down offline.
      </Note>

      <H2>Before you start</H2>
      <UL>
        <li>The creator wallet of the coin, in a Wallet Standard wallet such as Phantom, Solflare or Backpack.</li>
        <li>The coin's contract address (CA). You can copy it from the coin's page on pump.fun.</li>
        <li>A coin that has <strong className="text-ink font-normal">not</strong> already been migrated to a fee sharing config. If you have set up fee sharing on pump.fun before, the coin cannot be locked.</li>
        <li>A small amount of SOL for rent and fees, about 0.01 SOL.</li>
        <li>Paper and a pen. Do not store the 24 words in a screenshot, a notes app or a password manager synced to the cloud.</li>
        <li>About five quiet minutes. Writing the words down carefully is the only part that matters.</li>
      </UL>

      <H2>Lock a coin</H2>
      <Steps
        items={[
          ["Paste the contract address", <>Open <A to="/lock">Lock fees</A> and paste the coin's CA. silo looks the coin up and shows its name, image, market cap and volume so you can confirm it is the right one. If the coin is already in a silo, the page says so.</>],
          ["Choose the share", <>Drag the slider to choose what share of creator fees goes to the silo, from 1% to 100%. Whatever you do not route keeps flowing to your normal wallet, which is still an ed25519 key. Most creators choose 100%.</>],
          ["Connect the creator wallet", <>Connect the wallet that created the coin. pump.fun only lets the current creator configure fee sharing, so any other wallet would be rejected.</>],
          ["Write down your 24 words", <>Your browser generates a BIP-39 phrase locally. Write it down in order, then confirm three of the words when asked. The words never leave the tab and are not stored anywhere.</>],
          ["Review and sign", <>silo shows the silo address, the share and the hash of key #0. Tick both acknowledgements and approve the signature in your wallet. The message you sign names the coin, the silo and the key commitment.</>],
          ["Fees start flowing", <>The fee split is set, any pending fees are swept in, and the coin appears on the <A to="/coins">coins board</A> immediately. Every future creator fee lands in the silo without you doing anything.</>],
        ]}
      />

      <H2>Check your work</H2>
      <UL>
        <li>Find your coin on <A to="/coins">Coins</A>: it shows the share you chose and the time you locked it.</li>
        <li>Open <A to="/silo">Your silo</A> with the 24 words. If they open the same silo address shown at lock, your backup is correct.</li>
        <li>Store the words somewhere you will still be able to find in a few years, and tell yourself where.</li>
      </UL>

      <H2>Withdraw later</H2>
      <P>
        Open <A to="/silo">Your silo</A>, enter the 24 words and choose an amount and destination. The browser signs with
        the current one-time key and submits two transactions: <C>authorize</C>, which checks the signature and rotates the
        key, and <C>execute_sol</C>, which pays out exactly what you signed. See <A to="/docs/withdrawing">Withdrawing</A>.
      </P>

      <H2>Common problems</H2>
      <Table
        head={["Message", "What it means"]}
        rows={[
          ["This coin is already in a silo", "Someone, possibly you, has already locked it. A coin can only be locked once."],
          ["Wallet signature invalid", "The signature did not come from the connected wallet. Reconnect and try again."],
          ["This wallet can't sign messages", "Some wallets don't support message signing. Use Phantom, Solflare or Backpack."],
          ["No market found", "Very new coins can take a minute to appear in market data. Wait and paste the CA again."],
        ]}
      />
    </>
  );
}

export function Concepts() {
  return (
    <>
      <P>
        A short tour of the pieces silo is built from. Everything else in these docs uses these terms, so it is worth
        reading once even if you only plan to lock a single coin.
      </P>

      <H2>Silo</H2>
      <P>
        A silo is a program derived address (PDA) owned by the silo program, seeded by <C>["silo", first_key_hash]</C>.
        Because it is a PDA, no ed25519 private key exists for it: there is literally nothing to steal, guess or break.
        Lamports can only leave through the program, and the program only moves them when shown a valid hash-based
        signature for the exact withdrawal.
      </P>
      <P>
        The address is a pure function of key #0's hash, so the same 24 words always find the same silo, on any device,
        without silo storing anything about you.
      </P>

      <H2>One-time keys</H2>
      <P>
        Winternitz signatures are one-time: signing two different messages with the same key leaks enough of it to forge a
        third. silo therefore uses a chain of keys derived from your 24 words: key #0, key #1, key #2 and so on. Each
        withdrawal signs with the current key and, in the same signed message, commits to the hash of the next one. The
        program retires the old key before any funds move, so a signature can never be reused or replayed.
      </P>
      <Table
        head={["Term", "Meaning"]}
        rows={[
          ["Key index", "The number of the key the silo currently expects. Starts at 0 and increases by one per withdrawal."],
          ["Key hash", "SHA-256 of the 30 public chain ends of a key. The silo stores only this, never the key itself."],
          ["First key hash", "The hash of key #0. It is part of the PDA seed, so it identifies the silo forever."],
          ["Next key hash", "The hash of key #n+1, included in every signed withdrawal. Becomes the silo's key hash once the withdrawal is authorized."],
          ["Key commitment", "The link between consecutive keys. Each withdrawal proves the next key was chosen by whoever held the current one."],
        ]}
      />

      <H2>Chains and digits</H2>
      <P>
        A Winternitz key is 30 secret values. Hashing each one 255 times gives its public chain end. To sign, the message is
        hashed into 30 numbers between 0 and 255 (28 from the message and 2 checksum), and each secret is hashed that many
        times. A verifier finishes the remaining hashes on every chain and checks it reaches the public end. The checksum
        means nobody can push a chain forward to fake a different message without pushing another chain backward, which
        would require reversing SHA-256.
      </P>

      <H2>Fee route</H2>
      <P>
        pump.fun accrues creator fees in a creator vault PDA. Its fee sharing feature can migrate that vault to a sharing
        config with up to ten recipients, set once. silo uses this to make a silo a recipient for the share you choose.
        Distribution is permissionless, so anyone can push accrued fees into the silo at any time, and they keep arriving
        whether or not you ever come back.
      </P>

      <H2>Authorize and execute</H2>
      <P>
        Withdrawals happen in two instructions so the 840-byte signature fits in its own transaction. <C>authorize</C>
        verifies the signature, records the approved action and rotates the key. <C>execute_sol</C> (or{" "}
        <C>execute_token</C>) carries out exactly that action. Anyone can submit either; the signature, not the fee payer,
        is the authority. Someone who copies your withdrawal can only submit it for you.
      </P>

      <H2>Glossary</H2>
      <Table
        head={["Word", "Definition"]}
        rows={[
          ["ed25519", "The elliptic-curve signature scheme every Solana wallet uses. Broken by Shor's algorithm on a large quantum computer."],
          ["WOTS", "Winternitz One-Time Signature. A hash-based signature whose security rests on SHA-256 alone."],
          ["PDA", "Program derived address. An address controlled by a program, with no private key."],
          ["Grover's algorithm", "A quantum search that roughly halves the bit-security of hash functions. 224-bit chain values leave about 112 bits."],
          ["Crank", "Anyone calling a permissionless instruction, here the one that distributes pending fees into silos."],
        ]}
      />
    </>
  );
}

export function Locking() {
  return (
    <>
      <P>
        Locking connects a pump.fun coin to a silo. It is a one-time action that combines silo's own setup with
        pump.fun's fee sharing instructions.
      </P>

      <H2>What happens on chain</H2>
      <Table
        head={["#", "Instruction", "Program", "Effect"]}
        rows={[
          ["1", <C>open_silo</C>, "silo", "Creates the silo PDA and stores the hash of key #0."],
          ["2", <C>create_fee_sharing_config</C>, "Pump Fees", "Migrates the coin's creator vault (and the PumpSwap coin creator, if graduated) to a sharing config."],
          ["3", <C>update_fee_shares_v2</C>, "Pump Fees", "Sets the silo as a shareholder. pump.fun revokes the config admin afterwards, so the split is final."],
          ["4", <C>distribute_creator_fees_v2</C>, "Pump", "Sweeps any fees already pending into the silo. Permissionless."],
        ]}
      />

      <H2>Choosing a share</H2>
      <P>
        The lock screen has a slider from 1% to 100%, with quick presets at 25%, 50%, 75% and 100%. With anything below
        100%, the remaining share is assigned to the creator wallet that signed the lock. Choose 100% if the goal is that
        no creator fee ever touches an ed25519 key.
      </P>

      <H2>Graduated coins</H2>
      <P>
        Coins that have graduated to PumpSwap accrue creator fees in the AMM's coin creator vault. Those fees are first
        moved back to the bonding curve vault with <C>transfer_creator_fees_to_pump_v2</C>, which is permissionless, and
        then distributed like any other. silo's interface runs both steps when you lock a graduated coin.
      </P>

      <H2>Irreversibility</H2>
      <Note kind="warn">
        After <C>update_fee_shares_v2</C> the config admin is revoked. There is no instruction, in silo or in pump.fun,
        that can change the recipients. If the 24 words are lost, fees continue to arrive in a silo nobody can open.
      </Note>
      <P>
        This is deliberate. It is what lets holders trust that a coin's fees cannot be redirected later, and it is why the
        interface asks you to confirm three of your words and tick two acknowledgements before signing.
      </P>

      <H2>Costs</H2>
      <UL>
        <li>Rent for the silo account (195 bytes), refundable only by closing the silo, which the program does not support.</li>
        <li>Standard transaction fees for the four instructions.</li>
        <li>silo charges no fee on locking.</li>
      </UL>
    </>
  );
}

export function Withdrawing() {
  return (
    <>
      <P>
        A withdrawal moves SOL (or a quote token, for non-SOL pairs) from a silo to any address. It is signed with your
        24 words in the browser and checked on chain.
      </P>

      <Steps
        items={[
          ["Open the silo", <>Enter the 24 words on <A to="/silo">Your silo</A>. The browser derives key #0, computes the silo address and reads the current key index.</>],
          ["Describe the action", <>Choose an amount and a destination. To empty the silo, use <C>max</C>, which signs <C>u64::MAX</C> and pays everything above rent.</>],
          ["Grind a salt", <>The browser tries salts until the signature's verification work is at most 3,600 hashes. This keeps the on-chain check inside one transaction's compute budget. It usually takes a handful of tries.</>],
          ["Sign", <>Key #n signs the encoded withdrawal, which includes the hash of key #n+1. The result is 840 bytes.</>],
          ["Submit", <><C>authorize</C> verifies and rotates the key; <C>execute_sol</C> pays out. Both can be sent by any fee payer.</>],
        ]}
      />

      <H2>What you sign</H2>
      <P>
        The signed message binds every detail of the withdrawal: the program, the silo, the key number, the kind of
        asset, the mint, the amount, the destination, the next key hash and the salt. Changing any of them, even by one
        lamport, produces a different message and the signature no longer verifies. The exact layout is in{" "}
        <A to="/docs/signature-scheme">Signature scheme</A>.
      </P>

      <H2>Failed or interrupted withdrawals</H2>
      <UL>
        <li>If <C>authorize</C> lands but <C>execute_sol</C> does not, the approved action stays pending. Anyone can submit <C>execute_sol</C> later; it will pay exactly what was signed.</li>
        <li>While an action is pending, <C>authorize</C> rejects new signatures with <C>ActionPending</C>.</li>
        <li>If <C>authorize</C> never lands, nothing changed on chain. Sign again with the same key index.</li>
      </UL>

      <Note kind="tip">
        Withdraw to a fresh address you control and move funds onward from there. A withdrawal to a normal wallet is only
        as safe as that wallet.
      </Note>
    </>
  );
}

export function Verifying() {
  return (
    <>
      <P>
        Every withdrawal from every silo carries its signature in the transaction data, so anyone can re-run the check the
        program ran. The <A to="/verify">Verify</A> page does this in your browser from the raw bytes.
      </P>

      <H2>What the verifier does</H2>
      <OL>
        <li>Fetches the <C>authorize</C> transaction and decodes the signature, action and salt.</li>
        <li>Re-encodes the withdrawal message exactly as the program does.</li>
        <li>Hashes the message into 28 digits and appends the 2-digit checksum.</li>
        <li>Walks each of the 30 chains from the signature value to the top: <C>255 − digit</C> steps per chain.</li>
        <li>Hashes the 30 chain ends and compares the result with the key hash the silo held before the withdrawal.</li>
      </OL>
      <P>If the two hashes match, the signature is valid and the program had no choice but to pay.</P>

      <H2>The forge check</H2>
      <P>
        Tick <em>Forge it</em> and the page adds one lamport to the signed amount before checking. The message changes, the
        digits change, the chains end somewhere else, and the recomputed key no longer matches. It is a quick way to see
        that the signature covers every byte of the withdrawal.
      </P>

      <H2>Reading the chart</H2>
      <P>
        Each of the 30 bars is one chain. The grey part is the work the signer did (<C>digit</C> steps); the lit part is
        the work the verifier did (<C>255 − digit</C> steps). Together they always reach the top, which is the public key.
      </P>
    </>
  );
}

export function Keys() {
  return (
    <>
      <P>
        Your 24 words are the only key to your silo. There is no recovery service, no support ticket and no admin key.
        This page covers how the words are used and how to keep them.
      </P>

      <H2>How the words become keys</H2>
      <Code lang="text" title="derivation">{`
seed        = BIP39_mnemonic_to_seed(words, passphrase = "silo/v1")     // 64 bytes
sk[i][j]    = SHA256("silo/sk" || seed || u32le(i) || u8(j))[0..28]       // key i, chain j
pk[i][j]    = walk(sk[i][j], j, 0, 255)
key_hash[i] = SHA256(pk[i][0] || ... || pk[i][29])
`}</Code>
      <P>
        The passphrase is fixed to <C>silo/v1</C>, so the same 24 words used in a regular Solana wallet produce
        completely different keys here. Every key index is derived independently, which is why the browser can jump
        straight to key #n without replaying earlier withdrawals.
      </P>

      <H2>Storing the words</H2>
      <UL>
        <li>Write them on paper, in order, and keep at least two copies in separate places.</li>
        <li>Consider a metal backup for anything you intend to hold for years.</li>
        <li>Do not photograph them, type them into a notes app, or store them in a cloud-synced password manager.</li>
        <li>Only enter them on the silo site, and only on a device you trust.</li>
      </UL>

      <H2>One silo per phrase</H2>
      <P>
        Each lock generates a fresh phrase, and each phrase controls exactly one silo. If you lock several coins, keep
        each coin's words separately and label them by ticker.
      </P>

      <Note kind="warn" title="Lost words">
        If the words are lost, the silo is sealed forever. Fees will keep arriving and nobody, including silo, can move them.
      </Note>
    </>
  );
}
