/**
 * Extended type definitions for whatsapp-web.js features
 * that are not included in the library's TypeScript definitions.
 */
import { Chat, Client, Message } from 'whatsapp-web.js';

/**
 * Incoming call object from whatsapp-web.js incoming_call event.
 */
export interface WwjsCall {
  id: string;
  from: string;
  isVideo: boolean;
  isGroup: boolean;
}

/**
 * WhatsApp Group Chat with group-specific properties and methods.
 */
export interface GroupChat extends Omit<Chat, 'isReadOnly' | 'getLabels'> {
  participants: Array<{
    id: { _serialized: string; user: string };
    name?: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
  }>;
  description?: string;
  owner?: { _serialized: string };
  createdAt?: number;
  isReadOnly?: boolean;
  isAnnounce?: boolean;
  addParticipants(ids: string[]): Promise<void>;
  removeParticipants(ids: string[]): Promise<void>;
  promoteParticipants(ids: string[]): Promise<void>;
  demoteParticipants(ids: string[]): Promise<void>;
  leave(): Promise<void>;
  setSubject(subject: string): Promise<void>;
  setDescription(desc: string): Promise<void>;
  getLabels(): Promise<Array<{ id: string; name: string; hexColor: string }>>;
  addLabel(id: string): Promise<void>;
  removeLabel(id: string): Promise<void>;
  getInviteCode(): Promise<string>;
  revokeInvite(): Promise<string>;
  setAnnouncement(announce: boolean): Promise<void>;
  setInfoAdminsOnly(restrict: boolean): Promise<void>;
  setPicture(media: import('whatsapp-web.js').MessageMedia): Promise<void>;
}

/**
 * WhatsApp Message with reaction and edit methods.
 */
export interface MessageWithReactions extends Omit<Message, 'hasReaction' | 'getReactions' | 'react'> {
  react(emoji: string): Promise<void>;
  edit(newText: string): Promise<Message>;
  hasReaction?: boolean;
  getReactions(): Promise<
    Array<{
      id: string;
      senders: Array<{ senderId: string; reaction: string; timestamp: number }>;
    }>
  >;
}

/**
 * WhatsApp Business Client with label and channel methods.
 */
export interface BusinessClient extends Omit<
  Client,
  'subscribeToChannel' | 'unsubscribeFromChannel' | 'getLabels' | 'getLabelById' | 'getChannels' | 'getChannelById'
> {
  getLabels(): Promise<Array<{ id: string; name: string; hexColor: string }>>;
  getLabelById(id: string): Promise<{ id: string; name: string; hexColor: string } | null>;
  getChannels(): Promise<WwjsChannelData[]>;
  getChannelById(id: string): Promise<WwjsChannelData | null>;
  subscribeToChannel(inviteCode: string): Promise<WwjsChannelData>;
  unsubscribeFromChannel(id: string): Promise<void>;
}

/**
 * WhatsApp Channel/Newsletter data.
 */
export interface WwjsChannelData {
  id: { _serialized: string } | string;
  name?: string;
  description?: string;
  inviteCode?: string;
  subscriberCount?: number;
  verified?: boolean;
  fetchMessages(opts: { limit: number }): Promise<WwjsChannelMessage[]>;
}

/**
 * Channel message data.
 */
export interface WwjsChannelMessage {
  id: { _serialized: string } | string;
  body?: string;
  type?: string;
  timestamp?: number;
  hasMedia?: boolean;
  mediaUrl?: string;
}

/**
 * Group creation result.
 */
export interface GroupCreateResult {
  gid: { _serialized: string };
}
