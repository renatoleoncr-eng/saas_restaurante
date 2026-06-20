using System;
using System.Drawing;
using System.Windows.Forms;
using System.Diagnostics;
using System.Threading.Tasks;

namespace MakalaInstaller
{
    public class InstallerForm : Form
    {
        private Label lblTitle;
        private Label lblStatus;
        private Button btnInstall;
        private ProgressBar progressBar;

        public InstallerForm()
        {
            this.Text = "Instalador Agente Makala";
            this.Size = new Size(400, 250);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.BackColor = Color.White;

            lblTitle = new Label();
            lblTitle.Text = "Agente de Impresión Makala";
            lblTitle.Font = new Font("Segoe UI", 14, FontStyle.Bold);
            lblTitle.ForeColor = Color.FromArgb(0, 102, 204);
            lblTitle.AutoSize = true;
            lblTitle.Location = new Point(50, 20);
            this.Controls.Add(lblTitle);

            lblStatus = new Label();
            lblStatus.Text = "Haga clic en Instalar para configurar el agente en esta PC.\nEste proceso es rápido y automático.";
            lblStatus.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            lblStatus.AutoSize = true;
            lblStatus.Location = new Point(30, 60);
            this.Controls.Add(lblStatus);

            progressBar = new ProgressBar();
            progressBar.Style = ProgressBarStyle.Marquee;
            progressBar.Size = new Size(320, 20);
            progressBar.Location = new Point(30, 110);
            progressBar.Visible = false;
            this.Controls.Add(progressBar);

            btnInstall = new Button();
            btnInstall.Text = "Instalar";
            btnInstall.Font = new Font("Segoe UI", 10, FontStyle.Bold);
            btnInstall.BackColor = Color.FromArgb(0, 102, 204);
            btnInstall.ForeColor = Color.White;
            btnInstall.FlatStyle = FlatStyle.Flat;
            btnInstall.Size = new Size(120, 40);
            btnInstall.Location = new Point(130, 150);
            btnInstall.Click += BtnInstall_Click;
            this.Controls.Add(btnInstall);
        }

        private async void BtnInstall_Click(object sender, EventArgs e)
        {
            if (btnInstall.Text == "Cerrar")
            {
                this.Close();
                return;
            }

            btnInstall.Enabled = false;
            progressBar.Visible = true;
            lblStatus.Text = "Descargando e instalando componentes en segundo plano...\nPor favor espere.";

            try
            {
                await Task.Run(() => RunPowerShellInstaller());
                
                progressBar.Style = ProgressBarStyle.Blocks;
                progressBar.Value = 100;
                lblStatus.Text = "¡Instalación Completada Exitosamente!\nYa puede cerrar esta ventana y regresar a Makala.";
                lblStatus.ForeColor = Color.Green;
                btnInstall.Text = "Cerrar";
                btnInstall.Enabled = true;
                btnInstall.BackColor = Color.Green;
            }
            catch (Exception ex)
            {
                progressBar.Visible = false;
                lblStatus.Text = "Ocurrió un error: " + ex.Message;
                lblStatus.ForeColor = Color.Red;
                btnInstall.Enabled = true;
            }
        }

        private void RunPowerShellInstaller()
        {
            string command = "Invoke-WebRequest -Uri 'https://makala.maksuites.com.pe/api/config/printers/agent-download' -OutFile 'install.ps1' -UseBasicParsing; .\\install.ps1; Remove-Item 'install.ps1'";
            
            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = "powershell.exe";
            psi.Arguments = string.Format("-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -Command \"{0}\"", command);
            psi.UseShellExecute = true;
            psi.Verb = "runas";
            psi.WindowStyle = ProcessWindowStyle.Hidden;
            psi.CreateNoWindow = true;

            using (Process process = Process.Start(psi))
            {
                process.WaitForExit();
                if (process.ExitCode != 0)
                {
                    throw new Exception("El instalador devolvió el código de error " + process.ExitCode);
                }
            }
        }

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallerForm());
        }
    }
}
