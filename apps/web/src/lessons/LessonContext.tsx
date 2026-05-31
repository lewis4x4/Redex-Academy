import { createContext, useContext } from 'react';
import type { LessonData } from './lessonSource';

/** Ambient lesson state so MDX-embedded components (<KnowledgeCheck/>, <Sim/>)
 *  resolve their data/identity without the author hardcoding ids in the prose. */
export interface LessonCtxValue {
  lesson: LessonData;
  userId: string;
  orgId: string;
  locale: 'en' | 'es';
  online: boolean;
}

const LessonContext = createContext<LessonCtxValue | null>(null);
export const LessonProvider = LessonContext.Provider;

export function useLessonCtx(): LessonCtxValue {
  const v = useContext(LessonContext);
  if (!v) throw new Error('useLessonCtx must be used inside a LessonProvider');
  return v;
}
