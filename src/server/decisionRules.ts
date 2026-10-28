import { CriterionDefinition, CriterionId, CriterionRubric } from './types.js';

export const CRITERIA_DEFINITIONS: Record<CriterionId, CriterionDefinition> = {
  price_and_value: {
    id: 'price_and_value',
    name: 'Price and value for money',
    nameId: 'Harga dan Value for Money',
    weight: 0.20,
    description: 'Evaluasi harga ritel resmi, diskon pasar (THR deal), dan kelayakan spesifikasi terhadap biaya.'
  },
  performance_and_gaming: {
    id: 'performance_and_gaming',
    name: 'Performance and gaming',
    nameId: 'Performa & Gaming',
    weight: 0.15,
    description: 'Kemampuan prosesor Exynos 1380 (5nm), stabilitas benchmark AnTuTu/Geekbench, dan pengujian game (MLBB, PUBG, Genshin Impact, Wuthering Waves).'
  },
  battery_and_charging: {
    id: 'battery_and_charging',
    name: 'Battery and charging',
    nameId: 'Baterai & Pengisian Daya',
    weight: 0.15,
    description: 'Daya tahan baterai 5000 mAh dalam streaming/gaming dan kecepatan charging 25W.'
  },
  software_and_security: {
    id: 'software_and_security',
    name: 'Software and security support',
    nameId: 'Software & Dukungan Keamanan',
    weight: 0.15,
    description: 'One UI 7 (Android 15), jaminan update 6 tahun OS & security, hardware Knox Vault, dan fitur Awesome Intelligence.'
  },
  display_and_design: {
    id: 'display_and_design',
    name: 'Display and design',
    nameId: 'Layar & Desain Bodi',
    weight: 0.10,
    description: 'Panel Super AMOLED 120Hz 6.7" FHD+, kecerahan >1000 nits, ketebalan bodi 7.7mm, material kaca Victus+, serta evaluasi notch waterdrop dan bezel.'
  },
  camera: {
    id: 'camera',
    name: 'Camera',
    nameId: 'Kamera Foto & Video',
    weight: 0.10,
    description: 'Kamera utama 50MP OIS (video 4K 30fps), kamera ultrawide 8MP, kamera selfie 13MP, dan stabilisasi video.'
  },
  durability_and_protection: {
    id: 'durability_and_protection',
    name: 'Durability and protection',
    nameId: 'Ketahanan & Perlindungan',
    weight: 0.15,
    description: 'Sertifikasi ketahanan air dan debu IP67 serta proteksi Gorilla Glass Victus+ pada layar dan punggung.'
  }
};

export const RULESET_VERSION = 'v1.0.1-deterministic-prd';
export const EVIDENCE_DATASET_VERSION = 'v1.0.0-multi-source-indonesia';

export const RUBRICS_CONFIG: Record<CriterionId, CriterionRubric> = {
  price_and_value: {
    criterionId: 'price_and_value',
    version: '1.0.0',
    isFullySpecified: true,
    baseScoreFormula: 'Base value for 8/256GB 5G phone under Rp 4M (4.6) - missing in-box charger penalty (0.3) = 4.3',
    rulesDescription: [
      'Base 4.6 jika harga diskon <= Rp 3.8M dan spesifikasi mencakup 8GB RAM + 256GB storage + 5G.',
      'Deduction -0.3 karena adaptor charger dijual terpisah (tidak disertakan dalam paket ritel).'
    ]
  },
  performance_and_gaming: {
    criterionId: 'performance_and_gaming',
    version: '1.0.0',
    isFullySpecified: true,
    baseScoreFormula: 'Mid-range SoC Exynos 1380 with 600k+ AnTuTu (3.8) + smooth 90fps esports (+0.5) - heavy gaming thermal limits (-0.3) = 4.0',
    rulesDescription: [
      'Base 3.8 untuk AnTuTu 10 di kisaran 608k-609k dan Geekbench 6 multi-core 2800+.',
      'Bonus +0.5 untuk kemampuan 90fps di MLBB dan 60fps konstan di PUBG Mobile & Free Fire.',
      'Deduction -0.3 untuk throttling suhu mencapai 45°C di Genshin Impact & Wuthering Waves (direkomendasikan pendingin eksternal).'
    ]
  },
  battery_and_charging: {
    criterionId: 'battery_and_charging',
    version: '1.0.0',
    isFullySpecified: true,
    baseScoreFormula: 'Solid 5000mAh longevity (4.4) - slow 25W charging & 88m full charge deduction (-0.6) = 3.8',
    rulesDescription: [
      'Base 4.4 untuk ketahanan YouTube 25 jam (60Hz) / 17 jam (120Hz) dan dukungan Bypass Charging saat game.',
      'Deduction -0.6 karena pengisian 25W butuh 1 jam 28 menit untuk penuh, tertinggal dari standar mid-range kompetitor.'
    ]
  },
  software_and_security: {
    criterionId: 'software_and_security',
    version: '1.0.0',
    isFullySpecified: true,
    baseScoreFormula: 'Industry-leading 6 years OS & security patch + Knox Vault hardware in mid-range = 4.8',
    rulesDescription: [
      'Base 5.0 untuk komitmen 6 generasi OS update Android + 6 tahun security patch.',
      'Hardware Knox Vault + Secure Folder + Auto-Blocker setara standar flagship Samsung.',
      'Deduction -0.2 untuk pemangkasan sebagian fitur AI flagship (Instant Slow-Mo & Auto Trim absen, tanpa Bixby).'
    ]
  },
  display_and_design: {
    criterionId: 'display_and_design',
    version: '1.0.0',
    isFullySpecified: true,
    baseScoreFormula: 'Super AMOLED 120Hz + Victus+ Glass back (4.5) - waterdrop notch penalty (-0.5) - non-adaptive refresh (-0.3) - thick chin (-0.2) = 3.5',
    rulesDescription: [
      'Base 4.5 untuk panel Super AMOLED 120Hz, peak brightness 1025 nits, dan desain slim 7.7mm dengan kaca Victus+.',
      'Deduction -0.5 untuk desain kamera depan waterdrop / Infinity-U yang terasa ketinggalan zaman di kelas 4 jutaan.',
      'Deduction -0.3 karena refresh rate tidak adaptif (harus dipilih manual 60Hz atau 120Hz).',
      'Deduction -0.2 untuk bezel bagian bawah (dagu) yang terasa agak tebal.'
    ]
  },
  camera: {
    criterionId: 'camera',
    version: '1.0.0',
    isFullySpecified: true,
    baseScoreFormula: 'Main 50MP OIS 4K + Ultrawide present (4.0) - no 60fps on selfie (-0.2) - no EIS above 1080p30 (-0.2) - useless 2MP macro (-0.1) = 3.5',
    rulesDescription: [
      'Base 4.0 untuk kamera utama 50MP OIS stabil di 1080p 30fps, video 4K 30fps, dan ketersediaan ultrawide 8MP.',
      'Deduction -0.2 karena kamera selfie 13MP tidak mendukung perekaman 60fps dan soft di low light.',
      'Deduction -0.2 karena EIS tidak aktif pada video 4K dan 1080p 60fps (hanya OIS).',
      'Deduction -0.1 karena lensa makro 2MP dinilai tidak terlalu berguna.'
    ]
  },
  durability_and_protection: {
    criterionId: 'durability_and_protection',
    version: '1.0.0',
    isFullySpecified: true,
    baseScoreFormula: 'IP67 water/dust certification (4.0) + Victus+ front & back glass (+0.7) = 4.7',
    rulesDescription: [
      'Base 4.0 untuk sertifikasi resmi tahan air & debu IP67 (tahan rendam hingga 1 meter selama 30 menit).',
      'Bonus +0.7 untuk proteksi Gorilla Glass Victus+ ganda (pada layar dan punggung belakang).'
    ]
  }
};

// ============================================================
// CONFLICT DETECTION RULES
// ============================================================
// Konfigurasi konflik dipindahkan dari evidenceRepository.ts ke sini
// agar auditabel dan versionable (§9, §10.4).

export type ConflictTolerance = 'EXACT' | 'PERCENT_5' | 'CONTEXT_AWARE';

export interface ConflictRule {
  /** Atribut yang dipantau (lowercase, sesuai normalizer) */
  attribute: string;
  /** Topik untuk kategorisasi konflik */
  topic: string;
  /** Apakah konflik ini memblokir keputusan (§10.4) */
  isCritical: boolean;
  /**
   * Bagaimana menilai variance:
   * - EXACT: setiap perbedaan = konflik
   * - PERCENT_5: perbedaan <5% bukan konflik (benchmark variance)
   * - CONTEXT_AWARE: perbedaan konteks (context field) dianggap bukan konflik
   */
  tolerance: ConflictTolerance;
}

export const CONFLICT_RULES: ReadonlyArray<ConflictRule> = [
  { attribute: 'chipset',          topic: 'performance', isCritical: true,  tolerance: 'EXACT' },
  { attribute: 'battery_capacity', topic: 'battery',     isCritical: true,  tolerance: 'EXACT' },
  { attribute: 'price',            topic: 'price',       isCritical: false, tolerance: 'CONTEXT_AWARE' },
  { attribute: 'official_price',   topic: 'price',       isCritical: false, tolerance: 'CONTEXT_AWARE' },
  { attribute: 'purchase_price',   topic: 'price',       isCritical: false, tolerance: 'CONTEXT_AWARE' },
  { attribute: 'antutu_10_score',  topic: 'benchmark',   isCritical: false, tolerance: 'PERCENT_5' },
  { attribute: 'antutu_score',     topic: 'benchmark',   isCritical: false, tolerance: 'PERCENT_5' },
];

// ============================================================
// SPECIFICATIONS TABLE CONFIGURATION
// ============================================================
// Definisi baris spec table — dipisahkan dari komponen agar auditabel.

export interface SpecRowDefinition {
  label: string;
  attributes: string[];  // atribut dari evidence yang membentuk baris ini
}

export const SPEC_ROWS: ReadonlyArray<SpecRowDefinition> = [
  { label: 'Chipset (Prosesor)',  attributes: ['chipset', 'cpu_type', 'gpu_type', 'core_count', 'fab_process'] },
  { label: 'Layar',               attributes: ['screen_size', 'display_panel', 'refresh_rate', 'display_resolution', 'screen_resolution', 'peak_brightness', 'notch_type', 'protection_type'] },
  { label: 'RAM & ROM',           attributes: ['ram_capacity', 'ram_type', 'storage_capacity', 'storage_type', 'expandable_storage'] },
  { label: 'Kamera Belakang',     attributes: ['main_camera_resolution', 'ultrawide_camera_resolution', 'macro_camera_resolution', 'aperture', 'stabilization_feature'] },
  { label: 'Kamera Depan',        attributes: ['front_camera_resolution', 'resolution'] },
  { label: 'Software & Keamanan', attributes: ['android_version', 'os_update_years', 'security_patch_years', 'security_feature', 'ai_feature'] },
  { label: 'Baterai & Pengisian', attributes: ['battery_capacity', 'charging_wattage', 'charging_feature'] },
  { label: 'Durabilitas & Dimensi', attributes: ['ip_rating', 'certification', 'protection_type', 'back_material', 'thickness', 'weight', 'frame_material'] },
];