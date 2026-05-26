import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Profile } from './Profile';

// Mock api module
vi.mock('../services/api', () => ({
  userApi: {
    getMe: vi.fn(),
    updateMe: vi.fn(),
    changePassword: vi.fn(),
  },
}));

// Mock useDocumentTitle
vi.mock('../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }));

// Mock PageHeader
vi.mock('../components/PageHeader', () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

import { userApi } from '../services/api';
const mockUserApi = userApi as {
  getMe: ReturnType<typeof vi.fn>;
  updateMe: ReturnType<typeof vi.fn>;
  changePassword: ReturnType<typeof vi.fn>;
};

const mockProfile = {
  id: 'user-1',
  email: 'admin@localhost',
  role: 'admin',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderProfile(jwtPresent = true) {
  if (jwtPresent) {
    sessionStorage.setItem('openwa_jwt', 'fake.jwt.token');
  } else {
    sessionStorage.removeItem('openwa_jwt');
  }
  return render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('Profile page', () => {
  describe('without JWT (API key auth)', () => {
    it('shows notice instead of forms', () => {
      renderProfile(false);
      expect(screen.getByText(/only available when authenticated with email/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/new email/i)).not.toBeInTheDocument();
    });
  });

  describe('with JWT', () => {
    it('shows loading spinner initially', () => {
      mockUserApi.getMe.mockReturnValue(new Promise(() => {})); // never resolves
      renderProfile();
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('renders email and password forms after load', async () => {
      mockUserApi.getMe.mockResolvedValue(mockProfile);
      renderProfile();
      await waitFor(() => expect(screen.getByLabelText(/new email/i)).toBeInTheDocument());
      expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    });

    it('pre-fills email input with current email', async () => {
      mockUserApi.getMe.mockResolvedValue(mockProfile);
      renderProfile();
      await waitFor(() => expect(screen.getByLabelText<HTMLInputElement>(/new email/i).value).toBe('admin@localhost'));
    });

    it('shows error message when getMe fails', async () => {
      mockUserApi.getMe.mockRejectedValue(new Error('Network error'));
      renderProfile();
      await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
    });

    describe('email update', () => {
      it('calls updateMe and shows success', async () => {
        const user = userEvent.setup();
        mockUserApi.getMe.mockResolvedValue(mockProfile);
        mockUserApi.updateMe.mockResolvedValue({ ...mockProfile, email: 'new@example.com' });
        renderProfile();

        await waitFor(() => screen.getByLabelText(/new email/i));
        const emailInput = screen.getByLabelText<HTMLInputElement>(/new email/i);
        await user.clear(emailInput);
        await user.type(emailInput, 'new@example.com');
        await user.click(screen.getByRole('button', { name: /save email/i }));

        await waitFor(() => expect(mockUserApi.updateMe).toHaveBeenCalledWith('new@example.com'));
        expect(await screen.findByText(/email updated successfully/i)).toBeInTheDocument();
      });

      it('shows error on updateMe failure', async () => {
        const user = userEvent.setup();
        mockUserApi.getMe.mockResolvedValue(mockProfile);
        mockUserApi.updateMe.mockRejectedValue(new Error('Email already taken'));
        renderProfile();

        await waitFor(() => screen.getByLabelText(/new email/i));
        const emailInput = screen.getByLabelText<HTMLInputElement>(/new email/i);
        await user.clear(emailInput);
        await user.type(emailInput, 'taken@example.com');
        await user.click(screen.getByRole('button', { name: /save email/i }));

        expect(await screen.findByText(/email already taken/i)).toBeInTheDocument();
      });

      it('save email button disabled when email unchanged', async () => {
        mockUserApi.getMe.mockResolvedValue(mockProfile);
        renderProfile();
        await waitFor(() => screen.getByLabelText(/new email/i));
        expect(screen.getByRole('button', { name: /save email/i })).toBeDisabled();
      });
    });

    describe('password change', () => {
      it('calls changePassword and clears fields on success', async () => {
        const user = userEvent.setup();
        mockUserApi.getMe.mockResolvedValue(mockProfile);
        mockUserApi.changePassword.mockResolvedValue(undefined);
        renderProfile();

        await waitFor(() => screen.getByLabelText(/current password/i));
        await user.type(screen.getByLabelText(/current password/i), 'oldpass1');
        await user.type(screen.getByLabelText(/^new password$/i), 'newpass123');
        await user.type(screen.getByLabelText(/confirm new password/i), 'newpass123');
        await user.click(screen.getByRole('button', { name: /change password/i }));

        await waitFor(() => expect(mockUserApi.changePassword).toHaveBeenCalledWith('oldpass1', 'newpass123'));
        expect(await screen.findByText(/password changed successfully/i)).toBeInTheDocument();
        expect(screen.getByLabelText<HTMLInputElement>(/current password/i).value).toBe('');
      });

      it('shows error when passwords do not match', async () => {
        const user = userEvent.setup();
        mockUserApi.getMe.mockResolvedValue(mockProfile);
        renderProfile();

        await waitFor(() => screen.getByLabelText(/current password/i));
        await user.type(screen.getByLabelText(/current password/i), 'oldpass1');
        await user.type(screen.getByLabelText(/^new password$/i), 'newpass123');
        await user.type(screen.getByLabelText(/confirm new password/i), 'different');
        await user.click(screen.getByRole('button', { name: /change password/i }));

        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
        expect(mockUserApi.changePassword).not.toHaveBeenCalled();
      });

      it('shows error when new password is too short', async () => {
        const user = userEvent.setup();
        mockUserApi.getMe.mockResolvedValue(mockProfile);
        renderProfile();

        await waitFor(() => screen.getByLabelText(/current password/i));
        await user.type(screen.getByLabelText(/current password/i), 'oldpass1');
        await user.type(screen.getByLabelText(/^new password$/i), 'short');
        await user.type(screen.getByLabelText(/confirm new password/i), 'short');
        await user.click(screen.getByRole('button', { name: /change password/i }));

        expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
        expect(mockUserApi.changePassword).not.toHaveBeenCalled();
      });

      it('shows error on changePassword API failure', async () => {
        const user = userEvent.setup();
        mockUserApi.getMe.mockResolvedValue(mockProfile);
        mockUserApi.changePassword.mockRejectedValue(new Error('Current password is incorrect'));
        renderProfile();

        await waitFor(() => screen.getByLabelText(/current password/i));
        await user.type(screen.getByLabelText(/current password/i), 'wrongpass');
        await user.type(screen.getByLabelText(/^new password$/i), 'newpass123');
        await user.type(screen.getByLabelText(/confirm new password/i), 'newpass123');
        await user.click(screen.getByRole('button', { name: /change password/i }));

        expect(await screen.findByText(/current password is incorrect/i)).toBeInTheDocument();
      });

      it('change password button disabled when fields empty', async () => {
        mockUserApi.getMe.mockResolvedValue(mockProfile);
        renderProfile();
        await waitFor(() => screen.getByLabelText(/current password/i));
        expect(screen.getByRole('button', { name: /change password/i })).toBeDisabled();
      });
    });
  });
});
