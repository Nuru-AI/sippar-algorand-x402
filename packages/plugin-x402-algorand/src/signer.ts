/**
 * Algorand Transaction Signer
 *
 * Provides signing capabilities for x402 payments.
 * Supports local keypair signing with optional ICP threshold signing extension.
 */

import algosdk from 'algosdk';
import type { AlgorandSigner } from './types.js';

/**
 * Local keypair signer using algosdk
 */
export class LocalAlgorandSigner implements AlgorandSigner {
  private secretKey: Uint8Array;
  private address: string;

  constructor(privateKey: string) {
    // Support both mnemonic and secret key formats
    if (privateKey.includes(' ')) {
      // Mnemonic (25 words)
      const account = algosdk.mnemonicToSecretKey(privateKey);
      this.secretKey = account.sk;
      this.address = account.addr.toString();
    } else {
      // Base64-encoded secret key
      const secretKey = Buffer.from(privateKey, 'base64');
      if (secretKey.length !== 64) {
        throw new Error(
          'Invalid secret key length. Expected 64 bytes (base64) or 25-word mnemonic.'
        );
      }
      this.secretKey = new Uint8Array(secretKey);
      // Public key is the last 32 bytes
      this.address = algosdk.encodeAddress(secretKey.slice(32)).toString();
    }
  }

  async getAddress(): Promise<string> {
    return this.address;
  }

  async signTransaction(txnBytes: Uint8Array): Promise<Uint8Array> {
    // Decode the transaction
    const txn = algosdk.decodeUnsignedTransaction(txnBytes);

    // Sign and return the signed transaction bytes
    const signedTxn = txn.signTxn(this.secretKey);
    return signedTxn;
  }
}

/**
 * Create a signer from environment/config
 */
export function createSigner(privateKey: string): AlgorandSigner {
  if (!privateKey) {
    throw new Error(
      'ALGORAND_PRIVATE_KEY is required. Provide a 25-word mnemonic or base64-encoded secret key.'
    );
  }

  return new LocalAlgorandSigner(privateKey);
}
