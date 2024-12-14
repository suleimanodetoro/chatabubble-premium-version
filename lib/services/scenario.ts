// @/lib/services/scenario.ts
import { supabase } from '@/lib/supabase/client';
import { Scenario } from '@/types';
import { useAppStore } from '@/hooks/useAppStore';

export class ScenarioService {
  static async createScenario(scenario: Scenario, userId: string) {
    try {
      const { data, error } = await supabase
        .from('scenarios')
        .insert({
          id: scenario.id,
          title: scenario.title,
          description: scenario.description,
          category: scenario.category,
          difficulty: scenario.difficulty,
          target_language: scenario.targetLanguage,
          persona: scenario.persona,
          created_by: userId,
          is_public: false
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating scenario:', error);
      throw error;
    }
  }

  static async getScenariosForUser(userId: string) {
    try {
      const { data, error } = await supabase
        .from('scenarios')
        .select('*')
        .or(`created_by.eq.${userId},is_public.eq.true`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching scenarios:', error);
      throw error;
    }
  }
}