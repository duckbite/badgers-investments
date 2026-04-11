# State migration: certificate resources now use count.
moved {
  from = aws_acm_certificate.web
  to   = aws_acm_certificate.web[0]
}
