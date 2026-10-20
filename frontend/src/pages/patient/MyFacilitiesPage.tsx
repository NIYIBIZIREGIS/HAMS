import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Building2, Home, CalendarCheck, Info } from 'lucide-react';
import {
  listMyFacilities,
  facilityIdOf,
  type Facility,
  type PatientFacilityMembership,
} from '../../services/api';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { Link } from 'react-router-dom';

function asFacility(membership: PatientFacilityMembership): Facility | null {
  return typeof membership.facilityId === 'string' ? null : membership.facilityId;
}

/**
 * "Where am I treated?"
 *
 * A patient is one account that several hospitals may hold a record for. This lists each of
 * them and marks which is the home hospital, so the patient can see why a clinic can open
 * their record and book with a new one.
 */
export function MyFacilitiesPage() {
  const { t } = useTranslation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-facilities'],
    queryFn: listMyFacilities,
  });

  const memberships = data ?? [];
  const active = memberships.filter((m) => m.status === 'active');

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-main">
            {t('myFacilities.title')}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {t('myFacilities.subtitle')}
          </p>
        </div>
        <Link
          to="/book"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          <CalendarCheck className="h-4 w-4" />
          {t('myFacilities.bookAtAnother')}
        </Link>
      </header>

      {isError && (
        <Card className="border-status-cancelled-bg bg-status-cancelled-bg/40">
          <p className="text-sm text-status-cancelled-text">
            {t('myFacilities.loadFailed')}
          </p>
        </Card>
      )}

      {active.length === 0 ? (
        <Card className="text-center">
          <Building2 className="mx-auto h-10 w-10 text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">
            {t('myFacilities.none')}
          </p>
          <Link
            to="/book"
            className="mt-4 inline-block text-sm font-medium text-primary-600 hover:underline"
          >
            {t('myFacilities.findHospital')}
          </Link>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {active.map((membership) => {
              const facility = asFacility(membership);
              return (
                <Card key={membership._id ?? facilityIdOf(membership)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-text-main">
                        {facility?.name ?? t('myFacilities.unknownFacility')}
                      </h2>
                      <p className="mt-0.5 text-sm text-text-muted">
                        {[facility?.type, facility?.district, facility?.region]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    {membership.isPrimary && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
                        <Home className="h-3 w-3" />
                        {t('myFacilities.homeHospital')}
                      </span>
                    )}
                  </div>

                  {facility?.address && (
                    <p className="mt-3 text-sm text-text-muted">{facility.address}</p>
                  )}
                  {facility?.contactInfo?.phone && (
                    <p className="mt-1 text-sm text-text-muted">
                      {facility.contactInfo.phone}
                    </p>
                  )}

                  {/* A membership with no row is derived from `Patient.facilityId` on a database
                      that has not been backfilled yet, so it must not be dated. */}
                  <p className="mt-3 text-xs text-text-muted">
                    {membership.derivedFromPatientFacilityId
                      ? t('myFacilities.registeredHere')
                      : membership.registeredAt
                        ? t('myFacilities.memberSince', {
                            date: new Date(membership.registeredAt).toLocaleDateString(),
                          })
                        : t('myFacilities.registeredHere')}
                  </p>
                </Card>
              );
            })}
          </div>

          <Card className="flex items-start gap-3 bg-surface">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
            <p className="text-sm text-text-muted">
              {t('myFacilities.explainer')}
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
