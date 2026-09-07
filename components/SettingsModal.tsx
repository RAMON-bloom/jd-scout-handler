
import React, { useEffect, useMemo, useState } from 'react';
import { AnalysisResult, CopyGroup, FieldConfig } from '../types';
import ArrowUpIcon from './icons/ArrowUpIcon';
import ArrowDownIcon from './icons/ArrowDownIcon';
import TrashIcon from './icons/TrashIcon';
import XCircleIcon from './icons/XCircleIcon';
import ResultGroups from './ResultGroups';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    fields: FieldConfig[];
    groups: CopyGroup[];
    onSave: (fields: FieldConfig[], groups: CopyGroup[]) => void;
    previewData?: AnalysisResult | null;
}

const genFieldId = () => `field_${Math.random().toString(36).slice(2, 10)}`;

const buildSampleValue = (field: FieldConfig): string | string[] => {
    if (field.type === 'array') {
        return [1, 2, 3].map(n => `${field.label}のサンプル項目${n}`);
    }
    return `・${field.label}のサンプルテキストです\n・実際の抽出結果はこのように表示されます`;
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, fields, groups, onSave, previewData }) => {
    const [activeTab, setActiveTab] = useState<'fields' | 'groups'>('fields');
    const [localFields, setLocalFields] = useState<FieldConfig[]>([]);
    const [localGroups, setLocalGroups] = useState<CopyGroup[]>([]);

    useEffect(() => {
        if (isOpen) {
            setLocalFields([...fields].sort((a, b) => a.order - b.order));
            setLocalGroups([...groups].sort((a, b) => a.order - b.order));
            setActiveTab('fields');
        }
    }, [isOpen, fields, groups]);

    const previewMergedData = useMemo<AnalysisResult>(() => {
        const merged: AnalysisResult = {};
        localFields.forEach(field => {
            const realValue = previewData ? previewData[field.id] : undefined;
            merged[field.id] = realValue !== undefined && realValue !== null && realValue !== ''
                ? realValue
                : buildSampleValue(field);
        });
        return merged;
    }, [localFields, previewData]);

    if (!isOpen) return null;

    const handleFieldChange = (id: string, updates: Partial<FieldConfig>) => {
        setLocalFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const moveField = (index: number, direction: 'up' | 'down') => {
        const next = [...localFields];
        const target = direction === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        setLocalFields(next.map((f, i) => ({ ...f, order: i })));
    };

    const handleAddField = () => {
        const newField: FieldConfig = {
            id: genFieldId(),
            label: '新規項目',
            description: 'AIへの抽出指示をここに記述してください。',
            type: 'string',
            group: localGroups[0]?.id ?? 0,
            order: localFields.length,
            isEnabled: true,
        };
        setLocalFields(prev => [...prev, newField]);
    };

    const handleRemoveField = (id: string) => {
        setLocalFields(prev => prev.filter(f => f.id !== id).map((f, i) => ({ ...f, order: i })));
    };

    const handleGroupLabelChange = (id: number, label: string) => {
        setLocalGroups(prev => prev.map(g => g.id === id ? { ...g, label } : g));
    };

    const moveGroup = (index: number, direction: 'up' | 'down') => {
        const next = [...localGroups];
        const target = direction === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        setLocalGroups(next.map((g, i) => ({ ...g, order: i })));
    };

    const handleAddGroup = () => {
        const nextId = localGroups.length > 0 ? Math.max(...localGroups.map(g => g.id)) + 1 : 0;
        setLocalGroups(prev => [...prev, { id: nextId, label: '新規グループ', order: prev.length }]);
    };

    const handleRemoveGroup = (id: number) => {
        const inUse = localFields.some(f => f.group === id);
        if (inUse) {
            alert('このグループを使用している項目があるため削除できません。先に該当項目のグループを変更してください。');
            return;
        }
        setLocalGroups(prev => prev.filter(g => g.id !== id).map((g, i) => ({ ...g, order: i })));
    };

    const handleSubmit = () => {
        onSave(localFields, localGroups);
        onClose();
    };

    const inputStyle = "w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-sm focus:ring-1 focus:ring-cyan-500";
    const labelStyle = "block text-slate-500 dark:text-slate-400 text-xs font-bold mb-1";

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-950 shadow-2xl rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                    <div className="flex">
                        <button onClick={() => setActiveTab('fields')} className={`px-6 py-4 text-sm font-bold transition-colors ${activeTab === 'fields' ? 'text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-500' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}>抽出項目</button>
                        <button onClick={() => setActiveTab('groups')} className={`px-6 py-4 text-sm font-bold transition-colors ${activeTab === 'groups' ? 'text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-500' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}>コピーグループ</button>
                    </div>
                    <button onClick={onClose} className="mr-4 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <XCircleIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">
                <div className="p-6 overflow-y-auto flex-1 lg:w-1/2 lg:border-r border-slate-200 dark:border-slate-800">
                    {activeTab === 'fields' ? (
                        <div className="space-y-4">
                            {localFields.map((field, index) => (
                                <div key={field.id} className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-1">
                                                <button type="button" onClick={() => moveField(index, 'up')} disabled={index === 0} className="p-1 text-slate-400 hover:text-cyan-600 disabled:opacity-30">
                                                    <ArrowUpIcon className="h-4 w-4" />
                                                </button>
                                                <button type="button" onClick={() => moveField(index, 'down')} disabled={index === localFields.length - 1} className="p-1 text-slate-400 hover:text-cyan-600 disabled:opacity-30">
                                                    <ArrowDownIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={field.isEnabled} onChange={e => handleFieldChange(field.id, { isEnabled: e.target.checked })} className="w-4 h-4 text-cyan-600 rounded" />
                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">有効</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={field.includeLabelInCopy !== false} onChange={e => handleFieldChange(field.id, { includeLabelInCopy: e.target.checked })} className="w-4 h-4 text-cyan-600 rounded" />
                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">コピーに見出しを含める</span>
                                            </label>
                                        </div>
                                        <button type="button" onClick={() => handleRemoveField(field.id)} className="p-1.5 text-slate-400 hover:text-red-500">
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <div>
                                            <label className={labelStyle}>見出し名</label>
                                            <input type="text" value={field.label} onChange={e => handleFieldChange(field.id, { label: e.target.value })} className={inputStyle} />
                                        </div>
                                        <div>
                                            <label className={labelStyle}>形式</label>
                                            <select value={field.type} onChange={e => handleFieldChange(field.id, { type: e.target.value as 'string' | 'array' })} className={inputStyle}>
                                                <option value="string">文章</option>
                                                <option value="array">リスト（個別コピー可）</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelStyle}>コピーグループ</label>
                                            <select value={field.group} onChange={e => handleFieldChange(field.id, { group: Number(e.target.value) })} className={inputStyle}>
                                                {localGroups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className={labelStyle}>装飾(前)</label>
                                                <input type="text" value={field.prefix || ''} onChange={e => handleFieldChange(field.id, { prefix: e.target.value })} className={inputStyle} />
                                            </div>
                                            <div>
                                                <label className={labelStyle}>装飾(後)</label>
                                                <input type="text" value={field.suffix || ''} onChange={e => handleFieldChange(field.id, { suffix: e.target.value })} className={inputStyle} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <label className={labelStyle}>AIへの指示文（抽出ルール）</label>
                                        <textarea value={field.description} onChange={e => handleFieldChange(field.id, { description: e.target.value })} className={`${inputStyle} h-16`} />
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={handleAddField} className="w-full py-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:border-cyan-400 hover:text-cyan-600 transition-colors">
                                + 項目を追加
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">結果画面でまとめてコピーできる単位です。各項目のコピーグループはここで定義したグループから選択します。</p>
                            {localGroups.map((group, index) => (
                                <div key={group.id} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                                    <div className="flex gap-1">
                                        <button type="button" onClick={() => moveGroup(index, 'up')} disabled={index === 0} className="p-1 text-slate-400 hover:text-cyan-600 disabled:opacity-30">
                                            <ArrowUpIcon className="h-4 w-4" />
                                        </button>
                                        <button type="button" onClick={() => moveGroup(index, 'down')} disabled={index === localGroups.length - 1} className="p-1 text-slate-400 hover:text-cyan-600 disabled:opacity-30">
                                            <ArrowDownIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <input type="text" value={group.label} onChange={e => handleGroupLabelChange(group.id, e.target.value)} className={`${inputStyle} flex-1`} />
                                    <button type="button" onClick={() => handleRemoveGroup(group.id)} className="p-1.5 text-slate-400 hover:text-red-500">
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                            <button type="button" onClick={handleAddGroup} className="w-full py-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:border-cyan-400 hover:text-cyan-600 transition-colors">
                                + グループを追加
                            </button>
                        </div>
                    )}
                </div>

                <div className="p-6 overflow-y-auto flex-1 lg:w-1/2 bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300">プレビュー</h3>
                        {!previewData && (
                            <span className="text-xs text-slate-400 dark:text-slate-500">※サンプルテキストで表示中</span>
                        )}
                    </div>
                    <ResultGroups fields={localFields} groups={localGroups} data={previewMergedData} />
                </div>
                </div>

                <div className="p-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex gap-4">
                    <button type="button" onClick={onClose} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-lg font-bold">キャンセル</button>
                    <button type="button" onClick={handleSubmit} className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white py-3 rounded-lg font-bold">設定を保存</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
