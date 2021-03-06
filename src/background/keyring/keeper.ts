import { Key, KeyRing, KeyRingStatus } from "./keyring";

import { Address } from "@everett-protocol/cosmosjs/crypto";
import { AsyncApprover } from "../../common/async-approver";
import {
  TxBuilderConfigPrimitive,
  TxBuilderConfigPrimitiveWithChainId
} from "./types";

import { KVStore } from "../../common/kvstore";

import { openWindow } from "../../common/window";
import { ChainsKeeper } from "../chains/keeper";

export interface KeyHex {
  algo: string;
  pubKeyHex: string;
  addressHex: string;
  bech32Address: string;
}

interface SignMessage {
  chainId: string;
  message: Uint8Array;
}

export class KeyRingKeeper {
  private readonly keyRing: KeyRing;
  private path = "";

  private readonly unlockApprover = new AsyncApprover({
    defaultTimeout: 3 * 60 * 1000
  });

  private readonly txBuilderApprover = new AsyncApprover<
    TxBuilderConfigPrimitiveWithChainId,
    TxBuilderConfigPrimitive
  >({
    defaultTimeout: 3 * 60 * 1000
  });

  private readonly signApprover = new AsyncApprover<SignMessage>({
    defaultTimeout: 3 * 60 * 1000
  });

  constructor(kvStore: KVStore, public readonly chainsKeeper: ChainsKeeper) {
    this.keyRing = new KeyRing(kvStore);
  }

  async enable(): Promise<KeyRingStatus> {
    if (this.keyRing.status === KeyRingStatus.EMPTY) {
      throw new Error("key doesn't exist");
    }

    if (this.keyRing.status === KeyRingStatus.NOTLOADED) {
      await this.keyRing.restore();
    }

    if (this.keyRing.status === KeyRingStatus.LOCKED) {
      openWindow(browser.runtime.getURL("popup.html#/?external=true"));
      await this.unlockApprover.request("unlock");
      return this.keyRing.status;
    }

    return this.keyRing.status;
  }

  async checkAccessOrigin(chainId: string, origin: string) {
    await this.chainsKeeper.checkAccessOrigin(chainId, origin);
  }

  async checkBech32Address(chainId: string, bech32Address: string) {
    const key = await this.getKey();
    if (
      bech32Address !==
      new Address(key.address).toBech32(
        (await this.chainsKeeper.getChainInfo(chainId)).bech32Config
          .bech32PrefixAccAddr
      )
    ) {
      throw new Error("Invalid bech32 address");
    }
  }

  async restore(): Promise<KeyRingStatus> {
    await this.keyRing.restore();
    return this.keyRing.status;
  }

  async save(): Promise<void> {
    await this.keyRing.save();
  }

  /**
   * This will clear all key ring data.
   * Make sure to use this only in development env for testing.
   */
  async clear(): Promise<KeyRingStatus> {
    await this.keyRing.clear();
    return this.keyRing.status;
  }

  async createKey(mnemonic: string, password: string): Promise<KeyRingStatus> {
    // TODO: Check mnemonic checksum.
    await this.keyRing.createKey(mnemonic, password);
    return this.keyRing.status;
  }

  lock(): KeyRingStatus {
    this.keyRing.lock();
    return this.keyRing.status;
  }

  async unlock(password: string): Promise<KeyRingStatus> {
    await this.keyRing.unlock(password);
    try {
      this.unlockApprover.approve("unlock");
    } catch {
      // noop
    }
    return this.keyRing.status;
  }

  async setPath(chainId: string, account: number, index: number) {
    this.path = (
      await this.chainsKeeper.getChainInfo(chainId)
    ).bip44.pathString(account, index);
  }

  async getKey(): Promise<Key> {
    if (!this.path) {
      throw new Error("path not set");
    }

    return this.keyRing.getKey(this.path);
  }

  async requestTxBuilderConfig(
    config: TxBuilderConfigPrimitiveWithChainId,
    id: string,
    openPopup: boolean
  ): Promise<TxBuilderConfigPrimitive> {
    if (openPopup) {
      // Open fee window with hash to let the fee page to know that window is requested newly.
      openWindow(browser.runtime.getURL(`popup.html#/fee/${id}?external=true`));
    }

    const result = await this.txBuilderApprover.request(id, config);
    if (!result) {
      throw new Error("config is approved, but result config is null");
    }
    return result;
  }

  getRequestedTxConfig(id: string): TxBuilderConfigPrimitiveWithChainId {
    const config = this.txBuilderApprover.getData(id);
    if (!config) {
      throw new Error("Unknown config request id");
    }

    return config;
  }

  approveTxBuilderConfig(id: string, config: TxBuilderConfigPrimitive) {
    this.txBuilderApprover.approve(id, config);
  }

  rejectTxBuilderConfig(id: string): void {
    this.txBuilderApprover.reject(id);
  }

  async requestSign(
    chainId: string,
    message: Uint8Array,
    id: string,
    openPopup: boolean
  ): Promise<Uint8Array> {
    if (openPopup) {
      openWindow(
        browser.runtime.getURL(`popup.html#/sign/${id}?external=true`)
      );
    }

    await this.signApprover.request(id, { chainId, message });
    return this.keyRing.sign(this.path, message);
  }

  getRequestedMessage(id: string): SignMessage {
    const message = this.signApprover.getData(id);
    if (!message) {
      throw new Error("Unknown sign request id");
    }

    return message;
  }

  approveSign(id: string): void {
    this.signApprover.approve(id);
  }

  rejectSign(id: string): void {
    this.signApprover.reject(id);
  }
}
