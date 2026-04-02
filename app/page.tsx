import { createClient } from "@/lib/supabase/server";
import { login, signup, logout } from "@/app/auth/actions";

// Componentes do Frontend
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";

export default async function Page({ searchParams }: { searchParams: { error?: string, checkout?: string }}) {
  const supabase = createClient();

  // LINHA CORRIGIDA AQUI
  const {  user  } = await supabase.auth.getUser();
  
  let profile = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    profile = data;
  }

  if (!user || !profile) {
    return (
        <LoginPage 
            loginAction={login} 
            signupAction={signup} 
            error={searchParams.error} 
        />
    );
  }

  return (
    <Dashboard 
        user={{...user, ...profile}} // Combina dados de auth e profile
        logoutAction={logout} 
        checkoutStatus={searchParams.checkout}
    />
  );
}