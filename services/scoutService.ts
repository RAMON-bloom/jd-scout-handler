import { GoogleGenAI, Type } from "@google/genai";
import { AISection, FixedPhrase, PromptSection, SubjectData, SuccessKnowledge } from "../types";

let aiInstance: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!aiInstance) {
    const keysToCheck = [
      process.env.GEMINI_API_KEY,
      process.env.API_KEY,
      process.env.VITE_GEMINI_API_KEY
    ];
    const key = keysToCheck.find(k => k && k !== "undefined" && k !== "");

    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable not set");
    }

    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callWithRetry<T>(
  apiFn: (modelName: string) => Promise<T>,
  models: string[] = ["gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-flash-latest"],
  maxRetriesPerModel = 2
): Promise<T> {
  let lastError: any = null;

  for (const model of models) {
    let delayMs = 1500;
    for (let attempt = 0; attempt < maxRetriesPerModel; attempt++) {
      try {
        return await apiFn(model);
      } catch (error: any) {
        lastError = error;
        console.warn(`Gemini call failed with model ${model} (attempt ${attempt + 1}/${maxRetriesPerModel}):`, error);

        const errorMsg = String(error?.message || "");
        const errorCode = error?.status || error?.code || (error as any)?.error?.code || (error as any)?.error?.status;
        const errorStr = (JSON.stringify(error) + " " + errorMsg + " " + String(error?.stack || "")).toLowerCase();

        const isRateLimit = errorCode === 429 ||
                            errorStr.includes("429") ||
                            errorStr.includes("resource_exhausted") ||
                            errorStr.includes("quota") ||
                            errorStr.includes("limit") ||
                            errorStr.includes("rate");

        if (isRateLimit) {
          const jitter = Math.random() * 500;
          const waitTime = delayMs + jitter;
          console.log(`Rate limit detected. Retrying model ${model} in ${Math.round(waitTime)}ms...`);
          await delay(waitTime);
          delayMs *= 2.5;
        } else {
          await delay(500);
          break;
        }
      }
    }
  }

  throw lastError || new Error("All model generation attempts failed.");
}

export const generateScoutMessage = async (
    candidateExperience: string,
    candidateDesiredRole: string,
    jobInfo: string,
    fixedPhrases: FixedPhrase[],
    promptSections: PromptSection[],
    knowledge: SuccessKnowledge
): Promise<AISection[]> => {
  const enabledSections = promptSections.filter(s => s.enabled);

  const hasCandidateInfo = candidateExperience.trim() !== '' || candidateDesiredRole.trim() !== '';

  let knowledgeText = '';
  if (knowledge.structures && knowledge.structures.length > 0) {
    knowledgeText = `
# 過去の成功事例（返信率が高かった構成の参考）
以下の構成やトーンは過去に非常に高い返信率を得ています。これらを参考に、同様に魅力的で説得力のある文章を作成してください。
${knowledge.structures.map(s => `---
■ ${s.title}
${s.content}`).join('\n')}
---
`;
  }

  const phrasesToReplace = fixedPhrases.filter(p => p.key && p.value && p.insertionPoint === 'none');
  const fixedPhrasesContext = phrasesToReplace.length > 0
    ? '### プレースホルダー置換リスト\n' +
      phrasesToReplace
        .map(p => `- {${p.key}} → ${p.value}`)
        .join('\n') +
      '\n\n**重要**: 入力された求人情報や候補者情報の中に、上記の「{キー名}」が含まれている場合は、必ず対応する「内容」に置き換えてから文章を作成してください。'
    : '';

  const sectionInstructions = enabledSections.map(s => `- **セクションID: "${s.id}"** / **タイトル「${s.title}」**: ${s.instruction}`).join('\n');
  const sectionIdList = enabledSections.map(s => `"${s.id}"`).join(', ');

  const sectionInsertedPhrases = fixedPhrases.filter(p => p.value && enabledSections.some(s => s.id === p.insertionPoint));

  const prompt = `
あなたは優秀な転職エージェントです。候補者の情報を求人情報に基づき、プロフェッショナルでパーソナライズされたスカウトメッセージを生成してください。

# 候補者情報
${hasCandidateInfo ? `経験: ${candidateExperience}\n希望職種: ${candidateDesiredRole}` : '※候補者情報はありません。潜在的な候補者層に向けた魅力的な文章を作成してください。'}

# 求人情報
${jobInfo}

${knowledgeText}

${fixedPhrasesContext}

# 生成の指示
1. 以下の各セクションに対して、指定された指示に従って内容を生成してください。
   出力JSONのキーには、対応する「セクションID」をそのまま使用してください。
   **以下に列挙したセクションIDは1つも省略せず、必ず全て（${sectionIdList}）に対して値を生成してください。**
${sectionInstructions}

2. **重要：定型文との重複防止（最重要・厳守）**
   - 以下の文言リストは、プログラムによって自動的に各セクションの末尾に付与されます。
   - **AIはこれらの文言を「絶対に」生成内容に含めないでください。**
   - AIが生成すべきなのは、以下の文言が続く直前までの文章です。
${sectionInsertedPhrases.map(p => `   - セクション「${enabledSections.find(s => s.id === p.insertionPoint)?.title || '不明'}」の後に続く文言: "${p.value}"`).join('\n')}
   - 重複を防ぐため、上記の内容は完全に無視して、その手前のパーソナライズされたメッセージのみを出力してください。

3. **禁止事項**
   - 「候補者様」「貴殿」「あなた」といった二人称や「候補者」という呼称は使用せず、客観的で丁寧なエージェントの視点を保ってください。
   - 「～が見受けられます」という表現は避け、「～とお見受けしました」「～に魅力を感じました」などポジティブな表現を使用してください。
   - 年収推移は「初年度〇〇万円→3年後〇〇万円→5年後〇〇万円」という形式で具体的に記述してください。

4. 文字数
   - 各セクション200文字程度で簡潔にまとめてください。
`;

  const schema = {
    type: Type.OBJECT,
    properties: Object.fromEntries(
      enabledSections.map(s => [s.id, { type: Type.STRING, description: `セクション「${s.title}」の生成本文` }])
    ),
    required: enabledSections.map(s => s.id)
  };

  try {
    const rawResult = await callWithRetry(async (model) => {
      const client = getAiClient();
      const response = await client.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.7,
        }
      });
      return response.text;
    });

    const jsonText = (rawResult || "").trim();
    let parsedResult: Record<string, any> = {};
    try {
      let cleanJson = jsonText;
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```json?\s*/i, "").replace(/\s*```$/, "");
      }
      parsedResult = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error("JSON parsing failed", parseErr);
      throw new Error("AIの応答をセクションデータとして解析できませんでした。");
    }

    const sections: AISection[] = enabledSections.map(s => ({
      id: s.id,
      title: s.title,
      content: typeof parsedResult[s.id] === 'string' ? parsedResult[s.id] : '',
    }));

    return sections;
  } catch (error: any) {
    console.error("Error generating content from Gemini API:", error);
    const innerMsg = error?.message || String(error);
    if (innerMsg.includes("RESOURCE_EXHAUSTED") || innerMsg.includes("429")) {
      throw new Error("Gemini APIの利用制限（RESOURCE_EXHAUSTED / 429）に達しました。自動リトライを行いましたが解決しませんでした。しばらく時間をおいてから再度お試しいただくか、APIキーのクォータ設定を確認してください。");
    }
    throw new Error(`スカウト文の生成に失敗しました: ${innerMsg}`);
  }
};

export const generateScoutSubjects = async (jobInfo: string, knowledge: SuccessKnowledge): Promise<SubjectData> => {
    let successSubjectsText = '';
    if (knowledge.subjects && knowledge.subjects.length > 0) {
        successSubjectsText = `
# 過去に反応が良かった件名の例（これらを参考にしてください）
---
${knowledge.subjects.map(s => `- ${s}`).join('\n')}
---
`;
    }

    const prompt = `
you're an outstanding copywriter. Please craft scout subject lines in Japanese based on the job info so candidates feel compelled to click on them.

# 指示
- 求人情報の魅力を最大限に引き出すキーワードを10個挙げてください。
- 具体的な件名の参考例を5個作成してください。
- **特に重要**: 求人情報に記載されている「具体的なプロジェクト事例（例：大規模ECサイトのリプレイス、新規SaaSの立ち上げなど）」や「具体的な成果・技術的挑戦」を件名に盛り込んでください。
- 単なる「募集」ではなく、候補者が「自分の経験が活かせそう」「面白そうなプロジェクトだ」と感じるような、具体的かつ魅力的な表現を心がけてください。
${successSubjectsText}
- 必ず指定された JSON 形式で出力してください。

# 求人情報
---
${jobInfo}
---
`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            keywords: {
                type: Type.ARRAY,
                description: '求人情報の魅力を伝えるキャッチーなキーワード10個',
                items: { type: Type.STRING }
            },
            subjects: {
                type: Type.ARRAY,
                description: '生成したキーワードや具体的なプロジェクト事例を用いた、魅力的なスカウト件名の参考例5個',
                items: { type: Type.STRING }
            }
        },
        required: ['keywords', 'subjects']
    };

    try {
        const rawResult = await callWithRetry(async (model) => {
            const client = getAiClient();
            const response = await client.models.generateContent({
              model: model,
              contents: prompt,
              config: {
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.8,
              }
            });
            return response.text;
        });

        const jsonText = (rawResult || "").trim();
        let cleanJson = jsonText;
        if (cleanJson.startsWith("```")) {
          cleanJson = cleanJson.replace(/^```json?\s*/i, "").replace(/\s*```$/, "");
        }
        return JSON.parse(cleanJson);

    } catch (error: any) {
        console.error("Error generating subjects from Gemini API:", error);
        const innerMsg = error?.message || String(error);
        if (innerMsg.includes("RESOURCE_EXHAUSTED") || innerMsg.includes("429")) {
          throw new Error("Gemini APIの利用制限（RESOURCE_EXHAUSTED / 429）に達しました。自動リトライを行いましたが解決しませんでした。しばらく時間をおいてから件名の再生成をお試しください。");
        }
        throw new Error(`件名の生成に失敗しました: ${innerMsg}`);
    }
};
