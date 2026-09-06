
import React, { useCallback, useMemo, useState } from 'react';
import { AnalysisResult, CopyGroup, FieldConfig } from '../types';
import ClipboardIcon from './icons/ClipboardIcon';
import CheckIcon from './icons/CheckIcon';
import ResultCard from './ResultCard';

interface ResultGroupsProps {
    fields: FieldConfig[];
    groups: CopyGroup[];
    data: AnalysisResult;
}

const stripLeadingBullet = (s: string) => s.replace(/^[ \t]*[-*+・]\s*/, '');

const ResultGroups: React.FC<ResultGroupsProps> = ({ fields, groups, data }) => {
    const [copiedGroups, setCopiedGroups] = useState<Record<number, boolean>>({});
    const [copiedItem, setCopiedItem] = useState<string | null>(null);

    const groupedFields = useMemo(() => {
        const byGroup: Record<number, FieldConfig[]> = {};
        [...fields].filter(f => f.isEnabled).sort((a, b) => a.order - b.order).forEach(f => {
            if (!byGroup[f.group]) byGroup[f.group] = [];
            byGroup[f.group].push(f);
        });
        return [...groups]
            .sort((a, b) => a.order - b.order)
            .filter(g => byGroup[g.id]?.length)
            .map(g => ({ group: g, fields: byGroup[g.id] }));
    }, [fields, groups]);

    const handleCopyGroup = useCallback((groupId: number, groupFields: FieldConfig[]) => {
        const text = groupFields.map(f => {
            const val = data[f.id];
            if (!val) return '';
            return Array.isArray(val) ? val.map(stripLeadingBullet).join('\n') : val;
        }).filter(t => t !== '').join('\n\n');

        navigator.clipboard.writeText(text).then(() => {
            setCopiedGroups(prev => ({ ...prev, [groupId]: true }));
            setTimeout(() => setCopiedGroups(prev => ({ ...prev, [groupId]: false })), 2000);
        });
    }, [data]);

    const handleCopyItem = useCallback((text: string, key: string) => {
        navigator.clipboard.writeText(stripLeadingBullet(text)).then(() => {
            setCopiedItem(key);
            setTimeout(() => setCopiedItem(null), 2000);
        });
    }, []);

    if (groupedFields.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[200px] text-slate-400 dark:text-slate-500 text-sm">
                有効な項目がありません。
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {groupedFields.map(({ group, fields: groupFields }) => (
                <div key={group.id} className="relative bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-800/70 rounded-2xl p-5 space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400">{group.label}</h4>
                        <button
                            onClick={() => handleCopyGroup(group.id, groupFields)}
                            className="flex items-center px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm transition-all"
                        >
                            {copiedGroups[group.id] ? <CheckIcon className="h-4 w-4 mr-1.5 text-green-500" /> : <ClipboardIcon className="h-4 w-4 mr-1.5" />}
                            <span>{copiedGroups[group.id] ? 'コピーしました' : 'このブロックをコピー'}</span>
                        </button>
                    </div>
                    {groupFields.map(field => {
                        const value = data[field.id];
                        const fullLabel = `${field.prefix || ''}${field.label}${field.suffix || ''}`;
                        if (field.type === 'array' && Array.isArray(value)) {
                            return (
                                <div key={field.id} className="bg-white dark:bg-slate-950/80 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5">
                                    <h3 className="text-base font-bold text-cyan-600 dark:text-cyan-400 mb-3">{fullLabel}</h3>
                                    <ul className="space-y-2">
                                        {value.map((item: string, idx: number) => {
                                            const key = `${field.id}-${idx}`;
                                            return (
                                                <li key={idx} className="group flex justify-between items-center gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60">
                                                    <span className="flex-1 text-sm text-slate-800 dark:text-slate-200">{item}</span>
                                                    <button onClick={() => handleCopyItem(item, key)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700">
                                                        {copiedItem === key ? <CheckIcon className="h-4 w-4 text-green-500" /> : <ClipboardIcon className="h-4 w-4 text-slate-400" />}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            );
                        }
                        return <ResultCard key={field.id} title={fullLabel} content={typeof value === 'string' ? value : ''} />;
                    })}
                </div>
            ))}
        </div>
    );
};

export default ResultGroups;
