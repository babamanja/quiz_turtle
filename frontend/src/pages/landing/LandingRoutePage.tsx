import { Navigate, useSearchParams } from "react-router-dom";

import { isAuthenticatedUser, useSession } from "../../hooks/useSession";
import { homePathForUser } from "../../paths";
import { LEGAL_QUERY_KEY, parseLegalDocumentId } from "../legal/legalQuery";

import { LandingPage } from "./LandingPage";
import "./landing.scss";

export default function LandingRoutePage() {
  const [searchParams] = useSearchParams();
  const { user, token } = useSession();
  const legalDocumentId = parseLegalDocumentId(searchParams.get(LEGAL_QUERY_KEY));

  if (isAuthenticatedUser(user?.role, token) && !user?.isGuest && !legalDocumentId) {
    return <Navigate to={homePathForUser(user)} replace />;
  }

  return <LandingPage />;
}
