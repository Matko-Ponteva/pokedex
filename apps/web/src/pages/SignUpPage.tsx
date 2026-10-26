import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { signUpSchema } from "@pokedex/shared";
import { TextField } from "../components/TextField";
import { useCurrentUser, useSignUp } from "../hooks/useAuth";
import { toFieldErrors, type FieldErrors } from "../lib/formErrors";

export function SignUpPage() {
  const [values, setValues] = useState({ email: "", displayName: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const { data: user } = useCurrentUser();
  const signUp = useSignUp();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/teams";

  if (user) return <Navigate to={redirectTo} replace />;

  function submit() {
    const result = signUpSchema.safeParse(values);
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }
    setErrors({});
    signUp.mutate(result.data);
  }

  return (
    <main className="auth-page">
      <h1>Create an account</h1>
      <form
        className="auth-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={(email) => setValues({ ...values, email })}
        />
        <TextField
          label="Display name"
          name="displayName"
          autoComplete="nickname"
          value={values.displayName}
          error={errors.displayName}
          onChange={(displayName) => setValues({ ...values, displayName })}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          error={errors.password}
          onChange={(password) => setValues({ ...values, password })}
        />
        {signUp.error && <p className="form-error" role="alert">{signUp.error.message}</p>}
        <button type="submit" disabled={signUp.isPending}>
          {signUp.isPending ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login" state={location.state}>Log in</Link>
      </p>
    </main>
  );
}