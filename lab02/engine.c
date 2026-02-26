#include <math.h>

#define EXPORT __attribute__((used)) __attribute__((visibility("default")))

EXPORT
int solve_chunk(double* T, double* alpha, double* beta, double* Tnew, double* Q,
                 int N, double h, double tau, double rho, double c0, double lam0,
                 double Tleft, double Tright, int tdep, double dlam, double dc,
                 int hasConv, double hL, double TambL, double hR, double TambR,
                 int steps_to_run) {

    double inv_h2 = 1.0 / (h * h);
    double inv_tau = 1.0 / tau;
    int steps_done = 0;

    for (int step = 0; step < steps_to_run; step++) {
        alpha[1] = 0.0;
        beta[1] = Tleft;

        for (int i = 1; i < N; i++) {
            double Ti = T[i];
            double lam = lam0;
            double c = c0;

            if (tdep) {
                lam += dlam * Ti; if (lam < 0.01) lam = 0.01;
                c += dc * Ti;     if (c < 1.0) c = 1.0;
            }

            double A = lam * inv_h2;
            double rct = rho * c * inv_tau;
            double B = A + A + rct;
            double F = -(rct * Ti) - Q[i];

            double denom = B - A * alpha[i];
            double inv_denom = 1.0 / denom;
            alpha[i + 1] = A * inv_denom;
            beta[i + 1]  = (A * beta[i] - F) * inv_denom;
        }

        Tnew[N] = Tright;
        for (int i = N - 1; i >= 1; i--) {
            Tnew[i] = alpha[i + 1] * Tnew[i + 1] + beta[i + 1];
        }
        Tnew[0] = Tleft;

        // STEADY-STATE KONTROLÜ (Hızı düşürmemek için her 1000 adımda bir kontrol edilir)
        double max_diff = 0.0;
        int check_steady = (step % 1000 == 0);

        for (int i = 0; i <= N; i++) {
            if (check_steady) {
                double diff = Tnew[i] - T[i];
                if (diff < 0) diff = -diff; // Mutlak değer (fabs yerine daha hızlı)
                if (diff > max_diff) max_diff = diff;
            }
            T[i] = Tnew[i]; // Kopyalama
        }

        if (hasConv) {
            double lamLeft  = tdep ? (lam0 + dlam * T[0]) : lam0; if(lamLeft < 0.01) lamLeft = 0.01;
            double lamRight = tdep ? (lam0 + dlam * T[N]) : lam0; if(lamRight < 0.01) lamRight = 0.01;
            double lamH0 = lamLeft / h;
            double lamH1 = lamRight / h;
            if (hL > 0) T[0] = (lamH0 * T[1] + hL * TambL) / (lamH0 + hL);
            if (hR > 0) T[N] = (lamH1 * T[N - 1] + hR * TambR) / (lamH1 + hR);
        }

        steps_done++;

        // Eğer sistemdeki maksimum değişim çok küçükse, sistem dengeye gelmiştir! (Erken Çıkış)
        if (check_steady && max_diff < 0.0000001) {
            return steps_done; 
        }
    }
    return steps_done;
}