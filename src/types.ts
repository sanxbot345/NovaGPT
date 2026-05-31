export interface Attachment {
  name: string;
  size: string;
  type: string;
  base64?: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachmentName?: string;
  attachmentSize?: string;
  attachments?: Attachment[];
  groundingMetadata?: GroundingMetadata;
  isSearchModeUsed?: boolean;
  isThinkingModeUsed?: boolean;
}
