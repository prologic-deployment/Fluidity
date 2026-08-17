/**
 * Étapes de storytelling (texte) de chaque scène cinématique — config
 * centralisée : l'orchestrateur lit ces étapes pour construire les
 * superpositions HTML, et chaque scène 3D les référence pour rester
 * synchronisée. Les libellés sont des clés i18n (FR/EN) — aucun texte
 * codé en dur.
 */
import { StoryStage } from './common';

export const STAGES_BY_PRODUCT: Record<string, StoryStage[]> = {
  servicedesk: [
    { from: 0.0, to: 0.16, kickerKey: 'scene.servicedesk.s1.kicker', titleKey: 'scene.servicedesk.s1.title', textKey: 'scene.servicedesk.s1.text', align: 'center' },
    { from: 0.12, to: 0.42, kickerKey: 'scene.servicedesk.s2.kicker', titleKey: 'scene.servicedesk.s2.title', textKey: 'scene.servicedesk.s2.text', align: 'left' },
    { from: 0.38, to: 0.62, kickerKey: 'scene.servicedesk.s3.kicker', titleKey: 'scene.servicedesk.s3.title', textKey: 'scene.servicedesk.s3.text', align: 'right' },
    { from: 0.58, to: 0.82, kickerKey: 'scene.servicedesk.s4.kicker', titleKey: 'scene.servicedesk.s4.title', textKey: 'scene.servicedesk.s4.text', align: 'left' },
    { from: 0.78, to: 1.0, kickerKey: 'scene.servicedesk.s5.kicker', titleKey: 'scene.servicedesk.s5.title', textKey: 'scene.servicedesk.s5.text', align: 'center', cta: true },
  ],
  project_management: [
    { from: 0.0, to: 0.15, kickerKey: 'scene.project_management.s1.kicker', titleKey: 'scene.project_management.s1.title', textKey: 'scene.project_management.s1.text', align: 'center' },
    { from: 0.11, to: 0.4, kickerKey: 'scene.project_management.s2.kicker', titleKey: 'scene.project_management.s2.title', textKey: 'scene.project_management.s2.text', align: 'left' },
    { from: 0.36, to: 0.6, kickerKey: 'scene.project_management.s3.kicker', titleKey: 'scene.project_management.s3.title', textKey: 'scene.project_management.s3.text', align: 'right' },
    { from: 0.56, to: 0.8, kickerKey: 'scene.project_management.s4.kicker', titleKey: 'scene.project_management.s4.title', textKey: 'scene.project_management.s4.text', align: 'left' },
    { from: 0.76, to: 1.0, kickerKey: 'scene.project_management.s5.kicker', titleKey: 'scene.project_management.s5.title', textKey: 'scene.project_management.s5.text', align: 'center', cta: true },
  ],
  fleet_management: [
    { from: 0.0, to: 0.105, kickerKey: 'scene.fleet_management.s1.kicker', titleKey: 'scene.fleet_management.s1.title', textKey: 'scene.fleet_management.s1.text', align: 'center' },
    { from: 0.075, to: 0.195, kickerKey: 'scene.fleet_management.s2.kicker', titleKey: 'scene.fleet_management.s2.title', textKey: 'scene.fleet_management.s2.text', align: 'left' },
    { from: 0.165, to: 0.285, kickerKey: 'scene.fleet_management.s3.kicker', titleKey: 'scene.fleet_management.s3.title', textKey: 'scene.fleet_management.s3.text', align: 'right' },
    { from: 0.255, to: 0.375, kickerKey: 'scene.fleet_management.s4.kicker', titleKey: 'scene.fleet_management.s4.title', textKey: 'scene.fleet_management.s4.text', align: 'left' },
    { from: 0.345, to: 0.465, kickerKey: 'scene.fleet_management.s5.kicker', titleKey: 'scene.fleet_management.s5.title', textKey: 'scene.fleet_management.s5.text', align: 'right' },
    { from: 0.435, to: 0.565, kickerKey: 'scene.fleet_management.s6.kicker', titleKey: 'scene.fleet_management.s6.title', textKey: 'scene.fleet_management.s6.text', align: 'left' },
    { from: 0.535, to: 0.665, kickerKey: 'scene.fleet_management.s7.kicker', titleKey: 'scene.fleet_management.s7.title', textKey: 'scene.fleet_management.s7.text', align: 'right' },
    { from: 0.635, to: 0.755, kickerKey: 'scene.fleet_management.s8.kicker', titleKey: 'scene.fleet_management.s8.title', textKey: 'scene.fleet_management.s8.text', align: 'left' },
    { from: 0.725, to: 0.845, kickerKey: 'scene.fleet_management.s9.kicker', titleKey: 'scene.fleet_management.s9.title', textKey: 'scene.fleet_management.s9.text', align: 'right' },
    { from: 0.815, to: 0.935, kickerKey: 'scene.fleet_management.s10.kicker', titleKey: 'scene.fleet_management.s10.title', textKey: 'scene.fleet_management.s10.text', align: 'center' },
    { from: 0.905, to: 1.0, kickerKey: 'scene.fleet_management.s11.kicker', titleKey: 'scene.fleet_management.s11.title', textKey: 'scene.fleet_management.s11.text', align: 'center', cta: true },
  ],
  hr_center: [
    { from: 0.0, to: 0.15, kickerKey: 'scene.hr_center.s1.kicker', titleKey: 'scene.hr_center.s1.title', textKey: 'scene.hr_center.s1.text', align: 'center' },
    { from: 0.11, to: 0.4, kickerKey: 'scene.hr_center.s2.kicker', titleKey: 'scene.hr_center.s2.title', textKey: 'scene.hr_center.s2.text', align: 'right' },
    { from: 0.36, to: 0.6, kickerKey: 'scene.hr_center.s3.kicker', titleKey: 'scene.hr_center.s3.title', textKey: 'scene.hr_center.s3.text', align: 'left' },
    { from: 0.56, to: 0.8, kickerKey: 'scene.hr_center.s4.kicker', titleKey: 'scene.hr_center.s4.title', textKey: 'scene.hr_center.s4.text', align: 'right' },
    { from: 0.76, to: 1.0, kickerKey: 'scene.hr_center.s5.kicker', titleKey: 'scene.hr_center.s5.title', textKey: 'scene.hr_center.s5.text', align: 'center', cta: true },
  ],
  crm: [
    { from: 0.0, to: 0.15, kickerKey: 'scene.crm.s1.kicker', titleKey: 'scene.crm.s1.title', textKey: 'scene.crm.s1.text', align: 'center' },
    { from: 0.11, to: 0.4, kickerKey: 'scene.crm.s2.kicker', titleKey: 'scene.crm.s2.title', textKey: 'scene.crm.s2.text', align: 'left' },
    { from: 0.36, to: 0.6, kickerKey: 'scene.crm.s3.kicker', titleKey: 'scene.crm.s3.title', textKey: 'scene.crm.s3.text', align: 'right' },
    { from: 0.56, to: 0.8, kickerKey: 'scene.crm.s4.kicker', titleKey: 'scene.crm.s4.title', textKey: 'scene.crm.s4.text', align: 'left' },
    { from: 0.76, to: 1.0, kickerKey: 'scene.crm.s5.kicker', titleKey: 'scene.crm.s5.title', textKey: 'scene.crm.s5.text', align: 'center', cta: true },
  ],
  contract_management: [
    { from: 0.0, to: 0.15, kickerKey: 'scene.contract_management.s1.kicker', titleKey: 'scene.contract_management.s1.title', textKey: 'scene.contract_management.s1.text', align: 'center' },
    { from: 0.11, to: 0.4, kickerKey: 'scene.contract_management.s2.kicker', titleKey: 'scene.contract_management.s2.title', textKey: 'scene.contract_management.s2.text', align: 'right' },
    { from: 0.36, to: 0.6, kickerKey: 'scene.contract_management.s3.kicker', titleKey: 'scene.contract_management.s3.title', textKey: 'scene.contract_management.s3.text', align: 'left' },
    { from: 0.56, to: 0.8, kickerKey: 'scene.contract_management.s4.kicker', titleKey: 'scene.contract_management.s4.title', textKey: 'scene.contract_management.s4.text', align: 'right' },
    { from: 0.76, to: 1.0, kickerKey: 'scene.contract_management.s5.kicker', titleKey: 'scene.contract_management.s5.title', textKey: 'scene.contract_management.s5.text', align: 'center', cta: true },
  ],
  asset_management: [
    { from: 0.0, to: 0.15, kickerKey: 'scene.asset_management.s1.kicker', titleKey: 'scene.asset_management.s1.title', textKey: 'scene.asset_management.s1.text', align: 'center' },
    { from: 0.11, to: 0.4, kickerKey: 'scene.asset_management.s2.kicker', titleKey: 'scene.asset_management.s2.title', textKey: 'scene.asset_management.s2.text', align: 'left' },
    { from: 0.36, to: 0.6, kickerKey: 'scene.asset_management.s3.kicker', titleKey: 'scene.asset_management.s3.title', textKey: 'scene.asset_management.s3.text', align: 'right' },
    { from: 0.56, to: 0.8, kickerKey: 'scene.asset_management.s4.kicker', titleKey: 'scene.asset_management.s4.title', textKey: 'scene.asset_management.s4.text', align: 'left' },
    { from: 0.76, to: 1.0, kickerKey: 'scene.asset_management.s5.kicker', titleKey: 'scene.asset_management.s5.title', textKey: 'scene.asset_management.s5.text', align: 'center', cta: true },
  ],
  knowledge_center: [
    { from: 0.0, to: 0.15, kickerKey: 'scene.knowledge_center.s1.kicker', titleKey: 'scene.knowledge_center.s1.title', textKey: 'scene.knowledge_center.s1.text', align: 'center' },
    { from: 0.11, to: 0.4, kickerKey: 'scene.knowledge_center.s2.kicker', titleKey: 'scene.knowledge_center.s2.title', textKey: 'scene.knowledge_center.s2.text', align: 'left' },
    { from: 0.36, to: 0.6, kickerKey: 'scene.knowledge_center.s3.kicker', titleKey: 'scene.knowledge_center.s3.title', textKey: 'scene.knowledge_center.s3.text', align: 'right' },
    { from: 0.56, to: 0.8, kickerKey: 'scene.knowledge_center.s4.kicker', titleKey: 'scene.knowledge_center.s4.title', textKey: 'scene.knowledge_center.s4.text', align: 'left' },
    { from: 0.76, to: 1.0, kickerKey: 'scene.knowledge_center.s5.kicker', titleKey: 'scene.knowledge_center.s5.title', textKey: 'scene.knowledge_center.s5.text', align: 'center', cta: true },
  ],
  monitoring: [
    { from: 0.0, to: 0.15, kickerKey: 'scene.monitoring.s1.kicker', titleKey: 'scene.monitoring.s1.title', textKey: 'scene.monitoring.s1.text', align: 'center' },
    { from: 0.11, to: 0.4, kickerKey: 'scene.monitoring.s2.kicker', titleKey: 'scene.monitoring.s2.title', textKey: 'scene.monitoring.s2.text', align: 'right' },
    { from: 0.36, to: 0.6, kickerKey: 'scene.monitoring.s3.kicker', titleKey: 'scene.monitoring.s3.title', textKey: 'scene.monitoring.s3.text', align: 'left' },
    { from: 0.56, to: 0.8, kickerKey: 'scene.monitoring.s4.kicker', titleKey: 'scene.monitoring.s4.title', textKey: 'scene.monitoring.s4.text', align: 'right' },
    { from: 0.76, to: 1.0, kickerKey: 'scene.monitoring.s5.kicker', titleKey: 'scene.monitoring.s5.title', textKey: 'scene.monitoring.s5.text', align: 'center', cta: true },
  ],
  backup_management: [
    { from: 0.0, to: 0.15, kickerKey: 'scene.backup_management.s1.kicker', titleKey: 'scene.backup_management.s1.title', textKey: 'scene.backup_management.s1.text', align: 'center' },
    { from: 0.11, to: 0.4, kickerKey: 'scene.backup_management.s2.kicker', titleKey: 'scene.backup_management.s2.title', textKey: 'scene.backup_management.s2.text', align: 'left' },
    { from: 0.36, to: 0.6, kickerKey: 'scene.backup_management.s3.kicker', titleKey: 'scene.backup_management.s3.title', textKey: 'scene.backup_management.s3.text', align: 'right' },
    { from: 0.56, to: 0.8, kickerKey: 'scene.backup_management.s4.kicker', titleKey: 'scene.backup_management.s4.title', textKey: 'scene.backup_management.s4.text', align: 'left' },
    { from: 0.76, to: 1.0, kickerKey: 'scene.backup_management.s5.kicker', titleKey: 'scene.backup_management.s5.title', textKey: 'scene.backup_management.s5.text', align: 'center', cta: true },
  ],
  security_center: [
    { from: 0.0, to: 0.15, kickerKey: 'scene.security_center.s1.kicker', titleKey: 'scene.security_center.s1.title', textKey: 'scene.security_center.s1.text', align: 'center' },
    { from: 0.11, to: 0.4, kickerKey: 'scene.security_center.s2.kicker', titleKey: 'scene.security_center.s2.title', textKey: 'scene.security_center.s2.text', align: 'right' },
    { from: 0.36, to: 0.6, kickerKey: 'scene.security_center.s3.kicker', titleKey: 'scene.security_center.s3.title', textKey: 'scene.security_center.s3.text', align: 'left' },
    { from: 0.56, to: 0.8, kickerKey: 'scene.security_center.s4.kicker', titleKey: 'scene.security_center.s4.title', textKey: 'scene.security_center.s4.text', align: 'right' },
    { from: 0.76, to: 1.0, kickerKey: 'scene.security_center.s5.kicker', titleKey: 'scene.security_center.s5.title', textKey: 'scene.security_center.s5.text', align: 'center', cta: true },
  ],
  document_management: [
    { from: 0.0, to: 0.15, kickerKey: 'scene.document_management.s1.kicker', titleKey: 'scene.document_management.s1.title', textKey: 'scene.document_management.s1.text', align: 'center' },
    { from: 0.11, to: 0.4, kickerKey: 'scene.document_management.s2.kicker', titleKey: 'scene.document_management.s2.title', textKey: 'scene.document_management.s2.text', align: 'left' },
    { from: 0.36, to: 0.6, kickerKey: 'scene.document_management.s3.kicker', titleKey: 'scene.document_management.s3.title', textKey: 'scene.document_management.s3.text', align: 'right' },
    { from: 0.56, to: 0.8, kickerKey: 'scene.document_management.s4.kicker', titleKey: 'scene.document_management.s4.title', textKey: 'scene.document_management.s4.text', align: 'left' },
    { from: 0.76, to: 1.0, kickerKey: 'scene.document_management.s5.kicker', titleKey: 'scene.document_management.s5.title', textKey: 'scene.document_management.s5.text', align: 'center', cta: true },
  ],
  business_intelligence: [
    { from: 0.0, to: 0.15, kickerKey: 'scene.business_intelligence.s1.kicker', titleKey: 'scene.business_intelligence.s1.title', textKey: 'scene.business_intelligence.s1.text', align: 'center' },
    { from: 0.11, to: 0.4, kickerKey: 'scene.business_intelligence.s2.kicker', titleKey: 'scene.business_intelligence.s2.title', textKey: 'scene.business_intelligence.s2.text', align: 'left' },
    { from: 0.36, to: 0.6, kickerKey: 'scene.business_intelligence.s3.kicker', titleKey: 'scene.business_intelligence.s3.title', textKey: 'scene.business_intelligence.s3.text', align: 'right' },
    { from: 0.56, to: 0.8, kickerKey: 'scene.business_intelligence.s4.kicker', titleKey: 'scene.business_intelligence.s4.title', textKey: 'scene.business_intelligence.s4.text', align: 'left' },
    { from: 0.76, to: 1.0, kickerKey: 'scene.business_intelligence.s5.kicker', titleKey: 'scene.business_intelligence.s5.title', textKey: 'scene.business_intelligence.s5.text', align: 'center', cta: true },
  ],
  ai_assistant: [
    { from: 0.0, to: 0.15, kickerKey: 'scene.ai_assistant.s1.kicker', titleKey: 'scene.ai_assistant.s1.title', textKey: 'scene.ai_assistant.s1.text', align: 'center' },
    { from: 0.11, to: 0.4, kickerKey: 'scene.ai_assistant.s2.kicker', titleKey: 'scene.ai_assistant.s2.title', textKey: 'scene.ai_assistant.s2.text', align: 'left' },
    { from: 0.36, to: 0.6, kickerKey: 'scene.ai_assistant.s3.kicker', titleKey: 'scene.ai_assistant.s3.title', textKey: 'scene.ai_assistant.s3.text', align: 'right' },
    { from: 0.56, to: 0.8, kickerKey: 'scene.ai_assistant.s4.kicker', titleKey: 'scene.ai_assistant.s4.title', textKey: 'scene.ai_assistant.s4.text', align: 'left' },
    { from: 0.76, to: 1.0, kickerKey: 'scene.ai_assistant.s5.kicker', titleKey: 'scene.ai_assistant.s5.title', textKey: 'scene.ai_assistant.s5.text', align: 'center', cta: true },
  ],
  procurement: [
    { from: 0.0, to: 0.18, kickerKey: 'scene.procurement.s1.kicker', titleKey: 'scene.procurement.s1.title', textKey: 'scene.procurement.s1.text', align: 'center' },
    { from: 0.14, to: 0.46, kickerKey: 'scene.procurement.s2.kicker', titleKey: 'scene.procurement.s2.title', textKey: 'scene.procurement.s2.text', align: 'left' },
    { from: 0.42, to: 0.7, kickerKey: 'scene.procurement.s3.kicker', titleKey: 'scene.procurement.s3.title', textKey: 'scene.procurement.s3.text', align: 'right' },
    { from: 0.66, to: 1.0, kickerKey: 'scene.procurement.s4.kicker', titleKey: 'scene.procurement.s4.title', textKey: 'scene.procurement.s4.text', align: 'center', cta: true },
  ],
  time_tracking: [
    { from: 0.0, to: 0.18, kickerKey: 'scene.time_tracking.s1.kicker', titleKey: 'scene.time_tracking.s1.title', textKey: 'scene.time_tracking.s1.text', align: 'center' },
    { from: 0.14, to: 0.46, kickerKey: 'scene.time_tracking.s2.kicker', titleKey: 'scene.time_tracking.s2.title', textKey: 'scene.time_tracking.s2.text', align: 'left' },
    { from: 0.42, to: 0.7, kickerKey: 'scene.time_tracking.s3.kicker', titleKey: 'scene.time_tracking.s3.title', textKey: 'scene.time_tracking.s3.text', align: 'right' },
    { from: 0.66, to: 1.0, kickerKey: 'scene.time_tracking.s4.kicker', titleKey: 'scene.time_tracking.s4.title', textKey: 'scene.time_tracking.s4.text', align: 'center', cta: true },
  ],
  collaboration: [
    { from: 0.0, to: 0.18, kickerKey: 'scene.collaboration.s1.kicker', titleKey: 'scene.collaboration.s1.title', textKey: 'scene.collaboration.s1.text', align: 'center' },
    { from: 0.14, to: 0.46, kickerKey: 'scene.collaboration.s2.kicker', titleKey: 'scene.collaboration.s2.title', textKey: 'scene.collaboration.s2.text', align: 'left' },
    { from: 0.42, to: 0.7, kickerKey: 'scene.collaboration.s3.kicker', titleKey: 'scene.collaboration.s3.title', textKey: 'scene.collaboration.s3.text', align: 'right' },
    { from: 0.66, to: 1.0, kickerKey: 'scene.collaboration.s4.kicker', titleKey: 'scene.collaboration.s4.title', textKey: 'scene.collaboration.s4.text', align: 'center', cta: true },
  ],
};

/** Étapes de texte d'un produit (repli sur ServiceDesk). */
export function getCinematicStages(productKey: string): StoryStage[] {
  return STAGES_BY_PRODUCT[productKey] || STAGES_BY_PRODUCT['servicedesk'];
}
