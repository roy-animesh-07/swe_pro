import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, REGISTRAR, JUDGE, LAWYER } from './utils.jsx';
import { api, ApiError } from '../services/api.js';

vi.mock('../services/api.js', async (importOriginal) => {
  const actual = await importOriginal();
  const fns = Object.fromEntries(Object.keys(actual.api).map((k) => [k, vi.fn()]));
  return { ...actual, api: fns };
});

const CASE = {
  cin: 'CIN-000001',
  defendantName: 'John Doe',
  defendantAddress: '1 Main St',
  crimeType: 'Burglary',
  committedDate: '2026-01-10',
  committedLocation: 'Market',
  arrestingOfficer: 'Insp. K',
  arrestDate: '2026-01-12',
  judgeName: 'Justice Rao',
  publicProsecutor: 'P. Sen',
  lawyerName: 'Adv. Gupta',
  startDate: '2026-02-01',
  expectedCompletionDate: '2026-12-31',
  status: 'REGISTERED',
  judgmentDate: null,
  judgmentSummary: null,
  hearings: [],
};

beforeEach(() => {
  window.confirm = vi.fn(() => true);
});

describe('login', () => {
  it('logs in with valid credentials and lands on the role home page', async () => {
    api.login.mockResolvedValue({ user: LAWYER, token: 't' });
    renderApp('/login', { api });
    await userEvent.type(screen.getByLabelText('Username'), 'lawyer1');
    await userEvent.type(screen.getByLabelText('Password'), 'lawyer123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Search old cases' })).toBeInTheDocument();
    expect(localStorage.getItem('jis.token')).toBe('t');
  });

  it('shows the server error for invalid credentials', async () => {
    api.login.mockRejectedValue(new ApiError(401, 'NOT_AUTHENTICATED', 'Invalid username or password.'));
    renderApp('/login', { api });
    await userEvent.type(screen.getByLabelText('Username'), 'x');
    await userEvent.type(screen.getByLabelText('Password'), 'y');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password.');
  });

  it('requires both fields before calling the server', async () => {
    renderApp('/login', { api });
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your username and password.');
    expect(api.login).not.toHaveBeenCalled();
  });
});

describe('role-based access', () => {
  it('redirects unauthenticated users to login', async () => {
    renderApp('/registrar/users', { api });
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('a lawyer cannot open registrar pages and only sees lawyer navigation', async () => {
    renderApp('/registrar/queries/pending', { user: LAWYER, api });
    expect(await screen.findByRole('heading', { name: 'Search old cases' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).queryByText('Register case')).not.toBeInTheDocument();
    expect(api.pendingCases).not.toHaveBeenCalled();
  });

  it('a judge cannot open lawyer pages', async () => {
    renderApp('/lawyer/past-cases', { user: JUDGE, api });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Search old cases' })).toBeInTheDocument());
    expect(screen.getByText(/for reference/)).toBeInTheDocument();
  });
});

describe('case registration', () => {
  it('shows validation errors for an empty form and does not submit', async () => {
    renderApp('/registrar/cases/new', { user: REGISTRAR, api });
    await userEvent.click(await screen.findByRole('button', { name: 'Register case' }));
    expect(screen.getAllByText('Required')).toHaveLength(12);
    expect(api.registerCase).not.toHaveBeenCalled();
  });

  it('displays the generated CIN as read-only', async () => {
    api.registerCase.mockResolvedValue({ ...CASE, cin: 'CIN-000042' });
    renderApp('/registrar/cases/new', { user: REGISTRAR, api });
    await screen.findByRole('button', { name: 'Register case' });
    const values = {
      'Defendant name': 'John', 'Defendant address': 'Addr', 'Crime type': 'Theft',
      'Date crime was committed': '2026-01-01', 'Location crime was committed': 'Loc',
      'Arresting officer': 'Off', 'Arrest date': '2026-01-02', 'Presiding judge': 'J',
      'Public prosecutor': 'PP', Lawyer: 'L', 'Case starting date': '2026-02-01',
      'Expected completion date': '2026-12-01',
    };
    for (const [label, v] of Object.entries(values)) await userEvent.type(screen.getByLabelText(label), v);
    await userEvent.click(screen.getByRole('button', { name: 'Register case' }));
    const cin = await screen.findByTestId('generated-cin');
    expect(cin).toHaveValue('CIN-000042');
    expect(cin).toHaveAttribute('readonly');
    expect(api.registerCase.mock.calls[0][0].cin).toBeUndefined();
  });
});

describe('case management', () => {
  it('shows vacant slots and handles a slot that was booked meanwhile', async () => {
    api.getCase.mockResolvedValue(CASE);
    api.availability
      .mockResolvedValueOnce({ date: '2030-01-07', availableSlots: ['10:00-11:00', '11:00-12:00'] })
      .mockResolvedValueOnce({ date: '2030-01-07', availableSlots: ['11:00-12:00'] });
    api.scheduleHearing.mockRejectedValue(
      new ApiError(409, 'SLOT_ALREADY_BOOKED', 'The selected hearing slot is no longer available.')
    );
    renderApp('/registrar/cases/CIN-000001', { user: REGISTRAR, api });
    const dateInput = await screen.findByLabelText('Hearing date');
    await userEvent.type(dateInput, '2030-01-07');
    await userEvent.click(await screen.findByLabelText('10:00-11:00'));
    await userEvent.click(screen.getByRole('button', { name: 'Assign hearing' }));
    expect(await screen.findByText('The selected hearing slot is no longer available.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText('10:00-11:00')).not.toBeInTheDocument());
    expect(screen.getByLabelText('11:00-12:00')).toBeInTheDocument();
  });

  it('adjournment requires a reason and new date/time', async () => {
    api.getCase.mockResolvedValue({
      ...CASE,
      status: 'HEARING_SCHEDULED',
      hearings: [{ hearingId: 'HRG-000001', cin: 'CIN-000001', hearingDate: '2030-01-07', timeSlot: '10:00-11:00', status: 'SCHEDULED' }],
    });
    renderApp('/registrar/cases/CIN-000001', { user: REGISTRAR, api });
    await userEvent.click(await screen.findByRole('button', { name: 'Adjourn' }));
    expect(await screen.findByText('An adjournment reason is required.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Adjournment reason'), 'Witness absent');
    await userEvent.click(screen.getByRole('button', { name: 'Adjourn' }));
    expect(await screen.findByText('Choose the new hearing date and slot.')).toBeInTheDocument();
    expect(api.adjournHearing).not.toHaveBeenCalled();
  });

  it('records proceedings without a next hearing', async () => {
    const withHearing = {
      ...CASE,
      status: 'HEARING_SCHEDULED',
      hearings: [{ hearingId: 'HRG-000001', cin: 'CIN-000001', hearingDate: '2030-01-07', timeSlot: '10:00-11:00', status: 'SCHEDULED' }],
    };
    api.getCase.mockResolvedValue(withHearing);
    api.completeHearing.mockResolvedValue({ caseStatus: 'PENDING' });
    renderApp('/registrar/cases/CIN-000001', { user: REGISTRAR, api });
    await userEvent.type(await screen.findByLabelText('Proceedings summary'), 'Arguments heard');
    await userEvent.click(screen.getByLabelText(/Case continues/));
    await userEvent.click(screen.getByRole('button', { name: 'Save proceedings' }));
    await waitFor(() =>
      expect(api.completeHearing).toHaveBeenCalledWith('CIN-000001', 'HRG-000001', { proceedingsSummary: 'Arguments heard' })
    );
    expect(await screen.findByText('Proceedings recorded.')).toBeInTheDocument();
  });

  it('closes a pending case with judgment details', async () => {
    api.getCase.mockResolvedValue({ ...CASE, status: 'PENDING' });
    api.closeCase.mockResolvedValue({ ...CASE, status: 'CLOSED' });
    renderApp('/registrar/cases/CIN-000001', { user: REGISTRAR, api });
    await userEvent.type(await screen.findByLabelText('Judgment summary'), 'Convicted.');
    await userEvent.click(screen.getByRole('button', { name: 'Close case' }));
    await waitFor(() => expect(api.closeCase).toHaveBeenCalled());
    expect(api.closeCase.mock.calls[0][1].judgmentSummary).toBe('Convicted.');
  });

  it('shows a clean message for an unknown CIN', async () => {
    api.getCase.mockRejectedValue(new ApiError(404, 'CASE_NOT_FOUND', 'No case with CIN "CIN-999".'));
    renderApp('/registrar/cases/CIN-999', { user: REGISTRAR, api });
    expect(await screen.findByRole('alert')).toHaveTextContent('No case with CIN');
  });
});

describe('registrar queries', () => {
  it('pending cases', async () => {
    api.pendingCases.mockResolvedValue([{ ...CASE, status: 'PENDING' }]);
    renderApp('/registrar/queries/pending', { user: REGISTRAR, api });
    expect(await screen.findByText('CIN-000001')).toBeInTheDocument();
    expect(screen.getByText('P. Sen')).toBeInTheDocument();
  });

  it('resolved cases for a period', async () => {
    api.resolvedCases.mockResolvedValue([
      { startDate: '2026-01-01', cin: 'CIN-000003', judgmentDate: '2026-09-01', judgeName: 'J', judgmentSummary: 'Acquitted' },
    ]);
    renderApp('/registrar/queries/resolved', { user: REGISTRAR, api });
    await userEvent.type(await screen.findByLabelText('From'), '2026-01-01');
    await userEvent.type(screen.getByLabelText('To'), '2026-12-31');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('Acquitted')).toBeInTheDocument();
    expect(api.resolvedCases).toHaveBeenCalledWith('2026-01-01', '2026-12-31');
  });

  it('hearings by date', async () => {
    api.hearingsOn.mockResolvedValue([]);
    renderApp('/registrar/queries/hearings', { user: REGISTRAR, api });
    await userEvent.type(await screen.findByLabelText('Date'), '2030-01-07');
    await userEvent.click(screen.getByRole('button', { name: 'Show hearings' }));
    expect(await screen.findByText(/No hearings on/)).toBeInTheDocument();
  });

  it('status by CIN', async () => {
    api.caseStatus.mockResolvedValue({ cin: 'CIN-000001', status: 'HEARING_SCHEDULED' });
    renderApp('/registrar/queries/status', { user: REGISTRAR, api });
    await userEvent.type(await screen.findByLabelText('CIN'), 'cin-000001');
    await userEvent.click(screen.getByRole('button', { name: 'Check status' }));
    expect(await screen.findByText('Hearing scheduled')).toBeInTheDocument();
    expect(api.caseStatus).toHaveBeenCalledWith('CIN-000001');
  });
});

describe('old cases', () => {
  it('keyword search with no results', async () => {
    api.searchPastCases.mockResolvedValue([]);
    renderApp('/judge/past-cases', { user: JUDGE, api });
    await userEvent.type(await screen.findByLabelText('Keywords'), 'nothing');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText(/No old cases match/)).toBeInTheDocument();
  });

  it('lawyer must confirm, then sees the backend charge and details', async () => {
    api.viewPastCase.mockResolvedValue({ case: { ...CASE, status: 'CLOSED', judgmentDate: '2026-09-01', judgmentSummary: 'Convicted.' }, charge: 100, viewCount: 3 });
    renderApp('/lawyer/past-cases/CIN-000001', { user: LAWYER, api });
    const btn = await screen.findByRole('button', { name: 'Accept charge and view case' });
    expect(api.viewPastCase).not.toHaveBeenCalled();
    await userEvent.click(btn);
    expect(await screen.findByText(/100\.00 was recorded/)).toBeInTheDocument();
    expect(screen.getByText(/old cases viewed on your account: 3/)).toBeInTheDocument();
    expect(screen.getByText('Convicted.')).toBeInTheDocument();
  });

  it('lawyer view handles a charging failure without showing details', async () => {
    api.viewPastCase.mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'An unexpected server error occurred. Please try again.'));
    renderApp('/lawyer/past-cases/CIN-000001', { user: LAWYER, api });
    await userEvent.click(await screen.findByRole('button', { name: 'Accept charge and view case' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('unexpected server error');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('Hearing history')).not.toBeInTheDocument();
  });

  it('judge view loads immediately with no charge', async () => {
    api.viewPastCase.mockResolvedValue({ case: { ...CASE, status: 'CLOSED' }, charge: null });
    renderApp('/judge/past-cases/CIN-000001', { user: JUDGE, api });
    expect(await screen.findByText('Hearing history')).toBeInTheDocument();
    expect(screen.queryByText(/was recorded/)).not.toBeInTheDocument();
    expect(api.viewPastCase).toHaveBeenCalledTimes(1);
  });
});
