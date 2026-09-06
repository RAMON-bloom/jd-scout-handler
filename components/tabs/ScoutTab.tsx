
import React, { useCallback, useMemo, useState } from 'react';
import { usePresets } from '../../contexts/PresetContext';
import { EditableSection, FixedPhrase, PromptSection, SubjectData, SuccessKnowledge } from '../../types';
import PresetSwitcher from '../PresetSwitcher';
import ScoutForm from '../ScoutForm';
import ScoutResult from '../ScoutResult';
import SubjectResult from '../SubjectResult';
import PromptSettings from '../PromptSettings';
import FixedPhraseSettings from '../FixedPhraseSettings';
import KnowledgeSettings from '../KnowledgeSettings';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseMessageToSections = (message: string, promptSections: PromptSection[]): EditableSection[] => {
    if (!message.trim()) return [];

    const enabledSections = promptSections.filter(s => s.enabled && s.title.trim());
    if (enabledSections.length === 0) {
        return [{ id: 'full_message', title: '生成されたメッセージ', content: message.trim(), promptSectionId: '' }];
    }

    const headers = enabledSections.map(s => escapeRegex(s.title.trim()));
    const headerRegex = new RegExp(`\\s*(${headers.join('|')})\\s*`, 'g');
    const parts = message.split(headerRegex).filter(part => part !== undefined);

    const sections: EditableSection[] = [];
    let currentTitle = '';

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (!part) continue;

        const matchedSection = enabledSections.find(s => s.title.trim() === part);
        if (matchedSection) {
            currentTitle = part;
        } else if (currentTitle) {
            const existing = sections.find(s => s.title === currentTitle);
            const matchingPromptSection = enabledSections.find(s => s.title.trim() === currentTitle);
            if (existing) {
                existing.content += (existing.content ? '\n\n' : '') + part;
            } else {
                sections.push({
                    id: `${currentTitle}-${sections.length}`,
                    title: currentTitle,
                    content: part,
                    promptSectionId: matchingPromptSection ? matchingPromptSection.id : '',
                });
            }
        }
    }

    if (sections.length === 0 && message.trim()) {
        return [{ id: 'full_message', title: '生成されたメッセージ', content: message.trim(), promptSectionId: '' }];
    }
    return sections;
};

const reassembleGroupFromSections = (
    sections: EditableSection[],
    phrases: FixedPhrase[],
    promptSections: PromptSection[],
    groupId: number,
    isFirstGroup: boolean
): string => {
    const parts: string[] = [];

    const groupStartPhrase = phrases
        .filter(p => p.insertionPoint === `group_start:${groupId}` && p.value.trim())
        .map(p => p.value)
        .join('\n\n');
    if (groupStartPhrase) parts.push(groupStartPhrase);

    sections.forEach(section => {
        const matchedPs = promptSections.find(ps => ps.id === section.promptSectionId);
        const belongsToGroup = matchedPs ? matchedPs.group === groupId : isFirstGroup;
        if (!belongsToGroup) return;

        let block = `${section.title}\n${section.content}`;
        if (section.promptSectionId) {
            const inserted = phrases
                .filter(p => p.insertionPoint === section.promptSectionId && p.value.trim())
                .map(p => p.value)
                .join('\n\n');
            if (inserted) block += `\n\n${inserted}`;
        }
        parts.push(block);
    });

    return parts.join('\n\n').trim();
};

interface ScoutTabProps {
    idToken: string;
}

const ScoutTab: React.FC<ScoutTabProps> = ({ idToken }) => {
    const { activePreset, updateScoutConfig } = usePresets();
    const preset = activePreset('scout');
    const { promptSections, groups, fixedPhrases, knowledge } = preset.scout;

    const [candidateExperience, setCandidateExperience] = useState('');
    const [candidateDesiredRole, setCandidateDesiredRole] = useState('');
    const [jobInfo, setJobInfo] = useState('');
    const [editableSections, setEditableSections] = useState<EditableSection[]>([]);
    const [subjectData, setSubjectData] = useState<SubjectData>({ keywords: [], subjects: [] });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [subjectsError, setSubjectsError] = useState<string | null>(null);

    const sortedGroups = useMemo(() => [...groups].sort((a, b) => a.order - b.order), [groups]);

    const groupTargets = useMemo(() => {
        return sortedGroups
            .map((g, idx) => ({
                id: g.id,
                label: g.label,
                text: reassembleGroupFromSections(editableSections, fixedPhrases, promptSections, g.id, idx === 0),
            }))
            .filter(t => t.text);
    }, [sortedGroups, editableSections, fixedPhrases, promptSections]);

    const handleSaveFixedPhrases = useCallback((phrases: FixedPhrase[]) => {
        updateScoutConfig(preset.id, { ...preset.scout, fixedPhrases: phrases });
    }, [preset, updateScoutConfig]);

    const handleSavePromptSections = useCallback((sections: PromptSection[]) => {
        updateScoutConfig(preset.id, { ...preset.scout, promptSections: sections });
    }, [preset, updateScoutConfig]);

    const handleSaveKnowledge = useCallback((newKnowledge: SuccessKnowledge) => {
        updateScoutConfig(preset.id, { ...preset.scout, knowledge: newKnowledge });
    }, [preset, updateScoutConfig]);

    const handleGenerate = useCallback(async () => {
        if (!jobInfo.trim()) {
            setError('求人情報を入力してください。');
            return;
        }

        setIsLoading(true);
        setError(null);
        setSubjectsError(null);
        setEditableSections([]);
        setSubjectData({ keywords: [], subjects: [] });

        try {
            const msgResponse = await fetch('/api/scout-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                body: JSON.stringify({ candidateExperience, candidateDesiredRole, jobInfo, fixedPhrases, promptSections, knowledge }),
            });
            if (!msgResponse.ok) {
                const errData = await msgResponse.json();
                throw new Error(errData.error || `HTTP error! status: ${msgResponse.status}`);
            }
            const { sections: aiSections } = await msgResponse.json();

            const sections: EditableSection[] = promptSections
                .filter(ps => ps.enabled)
                .map((ps, index) => {
                    const aiMatch = aiSections?.find((as: any) => as.id === ps.id || as.title === ps.title);
                    return {
                        id: `${ps.title}-${index}-${index}`,
                        title: ps.title,
                        content: aiMatch ? aiMatch.content : '（セクション内容の生成に失敗しました）',
                        promptSectionId: ps.id,
                    };
                });
            setEditableSections(sections);

            try {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const subResponse = await fetch('/api/scout-subjects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                    body: JSON.stringify({ jobInfo, knowledge }),
                });
                if (!subResponse.ok) {
                    const errData = await subResponse.json();
                    throw new Error(errData.error || `HTTP error! status: ${subResponse.status}`);
                }
                setSubjectData(await subResponse.json());
            } catch (subErr: any) {
                console.warn('Subject generation failed gracefully:', subErr);
                setSubjectsError(subErr?.message || '件名の自動生成中にエラーが発生しました。');
            }
        } catch (err: any) {
            console.error(err);
            setError(err?.message || '生成中にエラーが発生しました。しばらくしてからもう一度お試しください。');
        } finally {
            setIsLoading(false);
        }
    }, [candidateExperience, candidateDesiredRole, jobInfo, fixedPhrases, promptSections, knowledge, idToken]);

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <PresetSwitcher tab="scout" />
            </div>

            <ScoutForm
                candidateExperience={candidateExperience}
                setCandidateExperience={setCandidateExperience}
                candidateDesiredRole={candidateDesiredRole}
                setCandidateDesiredRole={setCandidateDesiredRole}
                jobInfo={jobInfo}
                setJobInfo={setJobInfo}
                onGenerate={handleGenerate}
                isLoading={isLoading}
            />

            <KnowledgeSettings knowledge={knowledge} onSave={handleSaveKnowledge} />
            <PromptSettings promptSections={promptSections} groups={sortedGroups} onSave={handleSavePromptSections} />
            <FixedPhraseSettings fixedPhrases={fixedPhrases} promptSections={promptSections} groups={sortedGroups} onSave={handleSaveFixedPhrases} />

            {error && (
                <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-4 text-center text-red-700 dark:text-red-300">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:items-start">
                <div className="lg:col-span-3">
                    <ScoutResult
                        sections={editableSections}
                        onSectionChange={setEditableSections}
                        groupTargets={groupTargets}
                        isLoading={isLoading}
                    />
                </div>
                <div className="lg:col-span-2">
                    <SubjectResult subjectData={subjectData} isLoading={isLoading} error={subjectsError} />
                </div>
            </div>
        </div>
    );
};

export default ScoutTab;
