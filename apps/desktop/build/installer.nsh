; Ascension custom NSIS installer hooks
; Runs with admin rights during installation / uninstallation

!macro customInstall
  ; The app fetches the full blocklist (Steven Black's porn hosts list, 80k+ domains)
  ; on first launch and writes it to the hosts file. The installer just ensures the
  ; app has admin rights for that first write by triggering it here with a PowerShell
  ; command pointing at the app's own blocker script.
  ;
  ; For now we just flush DNS so any previous stale entries clear out.
  ExecWait "ipconfig /flushdns"
!macroend

!macro customUninstall
  ; Remove Ascension's blocked domains from the hosts file on uninstall.
  ; Uses PowerShell to strip lines between our markers.
  ; $$ in NSIS = literal $ passed to PowerShell
  ExecWait 'powershell -Command "$$hosts = Get-Content \"$WINDIR\System32\drivers\etc\hosts\"; $$start = $$hosts.IndexOf(\"# ASCENSION_BLOCKED_START\"); $$end = $$hosts.IndexOf(\"# ASCENSION_BLOCKED_END\"); if ($$start -ge 0 -and $$end -ge 0) { $$hosts = $$hosts[0..($$start-1)] + $$hosts[($$end+1)..($$hosts.Length-1)]; Set-Content \"$WINDIR\System32\drivers\etc\hosts\" $$hosts }; ipconfig /flushdns"'
!macroend
