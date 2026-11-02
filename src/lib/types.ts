/**
 * Contratos de dados do painel admin.
 *
 * Derivados das respostas reais do backend (`spottedbackend-main`):
 *   - /api/admin/auth/login  -> { success, message, token, admin }
 *   - /api/admin/auth/me     -> { success, admin, accounts }
 *   - /api/admin/accounts    -> { success, accounts }
 *   - /api/admin/pending     -> { success, posts }
 *   - /api/admin/users       -> { success, admins }
 *
 * O backend responde tudo dentro de `{ success: boolean, message?: string }`,
 * então os tipos abaixo espelham apenas os campos de dados.
 */

/** Envelope padrão de toda resposta da API. */
export interface ApiEnvelope {
  success: boolean;
  message?: string;
}

/** Resposta de erro do backend. */
export interface ApiErrorBody extends ApiEnvelope {
  message: string;
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                        */
/* -------------------------------------------------------------------------- */

export interface AdminProfile {
  id: string;
  username: string;
  is_super: boolean;
  created_at: string;
}

export interface LoginResponse extends ApiEnvelope {
  token: string;
  admin: Pick<AdminProfile, "id" | "username" | "is_super">;
}

export interface MeResponse extends ApiEnvelope {
  admin: AdminProfile;
  accounts: AccountSummary[];
}

/**
 * Resumo de conta devolvido por `/auth/me`.
 * Não inclui `slug` nem `is_active`, ao contrário de `/accounts`.
 */
export interface AccountSummary {
  id: string;
  username: string;
  ig_user_id: string;
  display_name: string | null;
  connection_status: string;
  needs_reauth: boolean;
  last_error: string | null;
  base_image_path: string | null;
  text_card_template_path: string | null;
  text_color: string;
  shadow_color: string;
  token_expires_at: string | null;
  token_refreshed_at: string | null;
  created_at: string;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/* Contas / Cidades                                                            */
/* -------------------------------------------------------------------------- */

/** Status de conexão com o Instagram, conforme gravado no banco. */
export const CONNECTION_STATUS = {
  ok: "ok",
  disconnected: "disconnected",
  error: "error",
  pending: "pending",
} as const;

export type ConnectionStatus =
  (typeof CONNECTION_STATUS)[keyof typeof CONNECTION_STATUS];

/** Linha completa de `instagram_accounts`, como devolvida por `/accounts`. */
export interface Account {
  id: string;
  username: string;
  ig_user_id: string;
  display_name: string | null;
  slug: string | null;
  is_active: boolean;
  connection_status: string;
  needs_reauth: boolean;
  last_error: string | null;
  base_image_path: string | null;
  text_card_template_path: string | null;
  text_color: string;
  shadow_color: string;
  /** URL pública do logo da cidade (bucket spotted-assets). */
  spotted_logo: string | null;
  /** `false` = publica no Instagram assim que o spotted é enviado. */
  is_moderated: boolean;
  token_expires_at: string | null;
  token_refreshed_at: string | null;
  created_at: string;
  updated_at: string;
  /**
   * Presente quando a rota teve acesso ao segredo. O access token em si
   * nunca é devolvido pela API — só a informação de que ele existe.
   */
  has_token?: boolean;
}

export interface AccountsResponse extends ApiEnvelope {
  accounts: Account[];
}

export interface AccountResponse extends ApiEnvelope {
  account: Account;
  /** Presente apenas em archive/unarchive. */
  message?: string;
}

/**
 * Campos editáveis via `PATCH /accounts/:id`.
 * O `username` é opcional de propósito: `undefined` deixa o valor atual
 * intacto, já que salvar as credenciais também o reescreve com o valor que a
 * Meta devolve.
 */
export interface AccountPatch {
  display_name?: string;
  username?: string;
  slug?: string;
  text_color?: string;
  shadow_color?: string;
  is_moderated?: boolean;
}

export interface AccountCreateInput {
  display_name: string;
  username?: string;
  is_moderated?: boolean;
}

export type AssetKind = "base" | "template";

/* -------------------------------------------------------------------------- */
/* Fila de aprovação                                                           */
/* -------------------------------------------------------------------------- */

export interface SpottedAccountRef {
  username: string;
  display_name: string | null;
  is_active: boolean;
}

export interface PendingPost {
  id: string;
  content: string;
  created_at: string;
  image_url: string | null;
  instagram_account_id: string;
  instagram_accounts: SpottedAccountRef | null;
  user_id: string | null;
  status?: string;
}

export interface PendingResponse extends ApiEnvelope {
  posts: PendingPost[];
}

export interface ApproveResponse extends ApiEnvelope {
  postId: number;
  instagramMediaId?: string;
  message: string;
}

export interface PreviewResponse extends ApiEnvelope {
  imageBase64: string;
}

/* -------------------------------------------------------------------------- */
/* Administradores                                                            */
/* -------------------------------------------------------------------------- */

/**
 * `POST /users` e `PUT /users/:id` devolvem o admin sem `account_ids`
 * (o backend usa `findById`, que não carrega as vinculações). O cliente
 * preenche o campo com `[]` e revalida a lista depois da mutação.
 */
export interface AdminUser {
  id: string;
  username: string;
  is_super: boolean;
  account_ids: string[];
  created_at: string;
}

export interface AdminListResponse extends ApiEnvelope {
  admins: AdminUser[];
}

export interface AdminResponse extends ApiEnvelope {
  admin: AdminUser;
  message: string;
}

export interface AdminCreateInput {
  username: string;
  password: string;
  is_super: boolean;
  accountIds: string[];
}

export interface AdminUpdateInput {
  username?: string;
  /** Ausente ou vazio mantém a senha atual. */
  password?: string;
  is_super?: boolean;
  accountIds?: string[];
}

/* -------------------------------------------------------------------------- */
/* Long-Lived Token                                                           */
/* -------------------------------------------------------------------------- */

export interface MetaPageItem {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
    username: string;
  };
}

export interface LongLivedTokenResponse extends ApiEnvelope {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  pages?: MetaPageItem[];
}

export interface LongLivedTokenInput {
  access_token: string;
}

/* -------------------------------------------------------------------------- */
/* Utilidades de apresentação                                                 */
/* -------------------------------------------------------------------------- */

/** Valores aceitos por `PATCH /accounts/:id` e pelo preview local do card. */
export const DEFAULT_TEXT_COLOR = "#ffffff";
export const DEFAULT_SHADOW_COLOR = "rgba(0, 0, 0, 0.65)";

/** Limite do upload de assets (8 MB), replicando o multer do backend. */
export const MAX_ASSET_BYTES = 8 * 1024 * 1024;
export const ASSET_MIME_TYPES = ["image/png", "image/jpeg"] as const;
