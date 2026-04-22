import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

type AscensionFunctionResponse = {
	success?: boolean;
	error?: string;
	partner_id?: string | null;
	partner_email?: string | null;
	pending?: boolean;
	linked_users?: number;
};

export async function invokeAscensionAction<T = AscensionFunctionResponse>(
	action: string,
	payload: Record<string, unknown>,
): Promise<T> {
	const { data, error } = await supabase.functions.invoke("ascension-api", {
		body: { action, payload },
	});

	if (error) {
		throw new Error(error.message);
	}

	const result = data as AscensionFunctionResponse | null;
	if (result?.error) {
		throw new Error(result.error);
	}

	return (data ?? {}) as T;
}

export async function linkPartner(userId: string, partnerEmail: string | null) {
	return invokeAscensionAction("users.linkPartner", {
		user_id: userId,
		partner_email: partnerEmail,
	});
}

export async function syncPartnerLinks(userId: string) {
	return invokeAscensionAction("users.syncPartnerLinks", {
		user_id: userId,
	});
}
