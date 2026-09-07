export type FieldType = 'string' | 'array';

export interface CopyGroup {
  id: number;
  label: string;
  order: number;
}

export interface FieldConfig {
  id: string;
  label: string;
  description: string;
  type: FieldType;
  group: number;
  order: number;
  isEnabled: boolean;
  prefix?: string;
  suffix?: string;
  includeLabelInCopy?: boolean;
}

export interface AnalysisResult {
  [key: string]: any;
}

export interface PromptSection {
  id: string;
  title: string;
  instruction: string;
  enabled: boolean;
  group: number;
  order: number;
}

export interface EditableSection {
  id: string;
  title: string;
  content: string;
  promptSectionId: string;
}

export interface AISection {
  id: string;
  title: string;
  content: string;
}

// insertionPoint: 'none' (placeholder-only, referenced as {key} in free text),
// `group_start:${CopyGroup['id']}` (inserted once, before that group's first enabled section),
// or a literal PromptSection.id (appended right after that specific section)
export type InsertionPoint = 'none' | string;

export interface FixedPhrase {
  key: string;
  value: string;
  insertionPoint: InsertionPoint;
}

export interface SuccessStructure {
  title: string;
  content: string;
}

export interface SuccessKnowledge {
  subjects: string[];
  structures: SuccessStructure[];
}

export interface SubjectData {
  keywords: string[];
  subjects: string[];
}

export interface ExtractionConfig {
  fields: FieldConfig[];
  groups: CopyGroup[];
}

export interface ScoutConfig {
  promptSections: PromptSection[];
  groups: CopyGroup[];
  fixedPhrases: FixedPhrase[];
  knowledge: SuccessKnowledge;
}

export interface MediaPreset {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  extraction: ExtractionConfig;
  scout: ScoutConfig;
}

export interface AppSettingsDocument {
  schemaVersion: number;
  presets: MediaPreset[];
  activePresetIdByTab: { extract: string; scout: string };
}

export interface Source {
  uri: string;
  title: string;
}
