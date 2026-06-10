import { requireUser } from '@/lib/server/auth';
import { getBalance, listTransactions, listWithdrawals, stripeConfigured, WALLET_LIMITS } from '@/lib/server/wallet-service';
import { handleApi } from '@/lib/server/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return handleApi(async () => {
    const user = await requireUser();
    const [balance, transactions, withdrawals] = await Promise.all([
      getBalance(user.id),
      listTransactions(user.id),
      listWithdrawals(user.id),
    ]);
    return {
      balance,
      transactions,
      withdrawals,
      stripeReady: stripeConfigured(),
      limits: {
        minDeposit: WALLET_LIMITS.MIN_DEPOSIT,
        maxDeposit: WALLET_LIMITS.MAX_DEPOSIT,
        minWithdrawal: WALLET_LIMITS.MIN_WITHDRAWAL,
        methods: WALLET_LIMITS.WITHDRAW_METHODS,
      },
    };
  });
}
