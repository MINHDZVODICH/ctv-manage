export function ErrorState({ message }: { message: string }) {
  return <p className="form-error" role="alert">{message}</p>;
}
