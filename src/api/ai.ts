import axios from 'axios';

export interface AiParseRequest {
  text: string;
  jobs: Array<{ JOB_UID: number; JOB_NAME: string }>;
  job_types: Array<{ JOB_TYPE_UID: number; JOB_TYPE: string }>;
  job_methods: Array<{ JOB_METHOD_UID: number; JOB_METHOD: string }>;
}

export interface AiParseResult {
  job_uid: number | null;
  job_type_uid: number | null;
  job_method_uid: number | null;
  hours: number | null;
  note: string;
}

const getApiKey = () => localStorage.getItem('wts_gemini_key') || '';

export const aiApi = {
  setApiKey: (key: string) => {
    localStorage.setItem('wts_gemini_key', key);
  },

  getApiKey,

  hasApiKey: () => !!getApiKey(),

  parseWork: async (data: AiParseRequest): Promise<{ data: AiParseResult }> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('Gemini API 키가 설정되지 않았습니다.');

    const jobList = data.jobs.map(j => `  - ${j.JOB_UID}: ${j.JOB_NAME}`).join('\n');
    const typeList = data.job_types.map(t => `  - ${t.JOB_TYPE_UID}: ${t.JOB_TYPE}`).join('\n');
    const methodList = data.job_methods.map(m => `  - ${m.JOB_METHOD_UID}: ${m.JOB_METHOD}`).join('\n');

    const prompt = `당신은 업무일지 입력을 도와주는 어시스턴트입니다.
사용자가 자연어로 업무 내용을 입력하면, 아래 목록에서 가장 적합한 항목을 매칭하고 정보를 추출해주세요.

[업무 목록]
${jobList}

[업무유형 목록]
${typeList}

[수행방법 목록]
${methodList}

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요.
매칭할 수 없는 항목은 null로 설정하세요.
hours는 정수 단위입니다 (최소 1).
note에는 업무 내용을 간결하게 요약해주세요.

{
  "job_uid": number | null,
  "job_type_uid": number | null,
  "job_method_uid": number | null,
  "hours": number | null,
  "note": "string"
}

사용자 입력: ${data.text}`;

    let res;
    try {
      res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 300,
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.error?.message || err.message;
        throw new Error(`Gemini API 오류: ${msg}`);
      }
      throw err;
    }

    const content = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error('Gemini 응답이 비어있습니다.');

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`AI 응답을 파싱할 수 없습니다: ${content}`);

    const parsed: AiParseResult = JSON.parse(jsonMatch[0]);
    return { data: parsed };
  },
};
