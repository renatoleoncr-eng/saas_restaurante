docker exec restaurante-db mysql -u restaurante_user -prestaurante_password gestion_restaurante -e 'DELETE FROM Orders WHERE AccountId = 781; DELETE FROM Accounts WHERE id = 781;'
